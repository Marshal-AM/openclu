# Install all OpenClu local dependencies (skill-capture + clawsync).
# Run from the repository root: .\scripts\setup-all.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location (Join-Path $Root "skill-capture")

$VenvPython = Join-Path $Root "skill-capture\venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
  Write-Host "Creating Python venv in skill-capture\venv …"
  python -m venv venv
}

Write-Host "Installing skill-capture (Node + Python) …"
& $VenvPython -m pip install -q --upgrade pip 2>$null
npm run setup
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location (Join-Path $Root "clawsync")
Write-Host "Installing clawsync (includes skill-marketplace via postinstall) …"
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Next steps:"
Write-Host "  1. Copy skill-capture\.env.example → skill-capture\.env and fill keys"
Write-Host "  2. Copy clawsync\.env.example → clawsync\.env"
Write-Host "  3. See SETUP.md for orchestrator, registration, and ClawSync runbooks"
