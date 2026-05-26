"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { syncWalletSession } from "@/components/auth/backend-session-sync";
import { useCurrentWallet } from "@/components/auth/current-wallet";
import { OpenCluLogo } from "@/components/OpenCluLogo";
import { Button } from "@/components/ui/button";

const HOME_PATH = "/contribute";

export default function LoginPage() {
  const router = useRouter();
  const { ready } = usePrivy();
  const { login } = useLogin();
  const { authenticated, walletAddress } = useCurrentWallet();
  const [syncing, setSyncing] = useState(false);
  const redirectStarted = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || !walletAddress || redirectStarted.current) return;

    redirectStarted.current = true;
    let mounted = true;
    setSyncing(true);

    void (async () => {
      try {
        await syncWalletSession(walletAddress);
        if (mounted) {
          setSyncing(false);
          router.replace(HOME_PATH);
        }
      } catch {
        if (mounted) {
          setSyncing(false);
          redirectStarted.current = false;
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [authenticated, ready, router, walletAddress]);

  const canLogin = ready && !authenticated && !syncing;

  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <section className="flex flex-col items-center gap-10">
        <OpenCluLogo priority className="h-auto w-72 max-w-[80vw]" />
        <Button
          type="button"
          size="lg"
          className="h-12 rounded-full px-8"
          disabled={!canLogin}
          onClick={() => login()}
        >
          {syncing || authenticated ? "Connecting..." : "Connect wallet"}
        </Button>
      </section>
    </main>
  );
}
