# Skill Capture device registration (Windows) - wallet + ngrok orchestrator URL
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
$EnvFile = Join-Path $Root ".env"
if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') { Set-Item -Path "env:$($matches[1])" -Value $matches[2] }
  }
}

$FrontendUrl = if ($env:FRONTEND_URL) { $env:FRONTEND_URL } else { "http://localhost:3000" }
$OrchestratorLocal = if ($env:ORCHESTRATOR_URL) { $env:ORCHESTRATOR_URL } else { "http://127.0.0.1:8790" }
$OrchestratorPort = if ($env:ORCHESTRATOR_PORT) { $env:ORCHESTRATOR_PORT } else { "8790" }

$DeviceName = $env:COMPUTERNAME
if (-not $DeviceName) { $DeviceName = "unknown-device" }
$DeviceId = [BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($DeviceName))).Replace("-","").ToLower()

$DeviceSalt = $null
if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^DEVICE_SALT=(.+)$') { $DeviceSalt = $matches[1] }
  }
}
if (-not $DeviceSalt) {
  $DeviceSalt = -join ((1..32) | ForEach-Object { "{0:x}" -f (Get-Random -Max 16) })
}

$WalletJson = node (Join-Path $Root "scripts\register-wallet.mjs") $DeviceSalt $DeviceId | ConvertFrom-Json
$DeviceAddress = $WalletJson.address
$DevicePrivateKey = $WalletJson.privateKey
$RegistrationToken = [guid]::NewGuid().ToString()

$OrchestratorPublic = ""
if ($env:ORCHESTRATOR_PUBLIC_URL) {
  $OrchestratorPublic = $env:ORCHESTRATOR_PUBLIC_URL.TrimEnd("/")
}
try {
  $health = Invoke-RestMethod -Uri "$OrchestratorLocal/health" -Method Get -TimeoutSec 5
  if ($health.publicUrl) {
    $OrchestratorPublic = "$($health.publicUrl)".TrimEnd("/")
  }
} catch {
  Write-Host "Orchestrator not reachable at $OrchestratorLocal - start: cd orchestrator; npm run start"
}
if (-not $OrchestratorPublic) {
  Write-Host "No ngrok URL yet - orchestrator prints it on npm run start (NGROK_AUTHTOKEN + pyngrok in venv)"
}

$lines = @()
if (Test-Path $EnvFile) {
  $lines = Get-Content $EnvFile | Where-Object {
    $_ -notmatch '^(DEVICE_|REGISTRATION_TOKEN|FRONTEND_URL|ORCHESTRATOR_PUBLIC_URL)='
  }
}
$lines += @(
  "DEVICE_ID=$DeviceId",
  "DEVICE_NAME=$DeviceName",
  "DEVICE_SALT=$DeviceSalt",
  "DEVICE_WALLET_ADDRESS=$DeviceAddress",
  "DEVICE_WALLET_PRIVATE_KEY=$DevicePrivateKey",
  "REGISTRATION_TOKEN=$RegistrationToken",
  "FRONTEND_URL=$FrontendUrl"
)
if ($OrchestratorPublic) { $lines += "ORCHESTRATOR_PUBLIC_URL=$OrchestratorPublic" }
$lines | Set-Content $EnvFile -Encoding utf8

$EncodedName = [uri]::EscapeDataString($DeviceName)
$EncodedDeviceId = [uri]::EscapeDataString($DeviceId)
$RegisterUrl = "$FrontendUrl/register?token=$RegistrationToken&address=$DeviceAddress&deviceName=$EncodedName&deviceId=$EncodedDeviceId"
if ($OrchestratorPublic) {
  $RegisterUrl += "&orchestratorUrl=$([uri]::EscapeDataString($OrchestratorPublic))"
}

Write-Host ""
Write-Host "=== Skill Capture Device Registration ==="
Write-Host "Device:     $DeviceName"
Write-Host "Address:    $DeviceAddress"
if ($OrchestratorPublic) { Write-Host "Orchestrator: $OrchestratorPublic" }
Write-Host ""
Write-Host "PRIVATE KEY (keep local):"
Write-Host $DevicePrivateKey
Write-Host ""
try {
  $body = @{
    registration_token = $RegistrationToken
    device_id = $DeviceId
    device_name = $DeviceName
    wallet_address = $DeviceAddress
  }
  if ($OrchestratorPublic) { $body.orchestrator_url = $OrchestratorPublic }
  Invoke-RestMethod -Uri "$FrontendUrl/api/devices/pending" -Method Post -Body ($body | ConvertTo-Json) -ContentType "application/json" | Out-Null
} catch {
  Write-Host "(Could not POST pending - start frontend with PORTAL_WALLET_PRIVATE_KEY in .env.local)"
}

Write-Host ""
Write-Host "Scan this QR to register the device in your browser:"
$QrScript = Join-Path $Root "scripts\print-registration-qr.mjs"
try {
  $env:REGISTER_URL = $RegisterUrl
  node $QrScript $RegisterUrl
  if ($LASTEXITCODE -ne 0) { throw "QR script failed" }
} catch {
  Write-Host "(QR unavailable - run npm install in skill-capture, then re-run register.ps1)"
  Write-Host "Register URL:"
  Write-Host $RegisterUrl
}
