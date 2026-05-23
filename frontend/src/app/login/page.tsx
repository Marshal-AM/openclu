"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { syncWalletSession } from "@/components/auth/backend-session-sync";
import { useCurrentWallet } from "@/components/auth/current-wallet";
import { OpenCluLogo } from "@/components/OpenCluLogo";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const { ready } = usePrivy();
  const { login } = useLogin();
  const { authenticated, walletAddress } = useCurrentWallet();
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function completeLogin() {
      if (!authenticated || !walletAddress || syncing) return;
      setSyncing(true);
      try {
        await syncWalletSession(walletAddress);
        if (mounted) router.replace("/contribute");
      } finally {
        if (mounted) setSyncing(false);
      }
    }

    void completeLogin();
    return () => {
      mounted = false;
    };
  }, [authenticated, router, syncing, walletAddress]);

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
