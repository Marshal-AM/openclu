"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { useLogin } from "@privy-io/react-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OpenCluLogo } from "@/components/OpenCluLogo";
import { syncWalletSession } from "@/components/auth/backend-session-sync";
import { useCurrentWallet } from "@/components/auth/current-wallet";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function RegisterForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const address = params.get("address") ?? "";
  const deviceName = params.get("deviceName") ?? "";
  const deviceId = params.get("deviceId") ?? "";
  const orchestratorUrl = params.get("orchestratorUrl") ?? "";
  const { login } = useLogin();
  const { authenticated, walletAddress } = useCurrentWallet();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function confirm() {
    if (!authenticated || !walletAddress) {
      setError("Please connect your owner wallet first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await syncWalletSession(walletAddress);
      const res = await fetch("/api/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, address, deviceName, deviceId, orchestratorUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-lg flex-col items-center gap-6">
      <OpenCluLogo className="h-auto w-56 max-w-[70vw]" />
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Register Device</CardTitle>
          <CardDescription>Confirm the local device and wallet from the registration link.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Registration failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!authenticated ? (
            <Alert>
              <AlertTitle>Owner login required</AlertTitle>
              <AlertDescription>
                Connect your Privy wallet first, then confirm device registration.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTitle>Logged in as owner</AlertTitle>
              <AlertDescription className="break-all font-mono text-xs">
                {walletAddress}
              </AlertDescription>
            </Alert>
          )}
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Device</dt>
              <dd className="font-medium">{deviceName || "Unavailable"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Wallet</dt>
              <dd className="break-all font-mono text-sm">{address || "Unavailable"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Portal</dt>
              <dd className="break-all font-mono text-xs">{orchestratorUrl || "Unavailable"}</dd>
            </div>
          </dl>
          <Badge variant={token && address && orchestratorUrl ? "secondary" : "destructive"} className="w-fit">
            {token && address && orchestratorUrl ? "Ready to confirm" : "Registration link incomplete"}
          </Badge>
        </CardContent>
        <CardFooter>
          {!authenticated ? (
            <Button type="button" onClick={() => login()} className="w-full">
              Connect owner wallet
            </Button>
          ) : (
            <Button
              type="button"
              onClick={confirm}
              disabled={loading || !token || !address || !orchestratorUrl}
              className="w-full"
            >
              <CheckIcon data-icon="inline-start" />
              {loading ? "Confirming..." : "Confirm registration"}
            </Button>
          )}
        </CardFooter>
      </Card>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center bg-background p-6">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </main>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
