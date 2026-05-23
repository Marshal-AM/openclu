"use client";

import { useEffect, useRef } from "react";
import { useCurrentWallet } from "@/components/auth/current-wallet";

export async function syncWalletSession(address: string) {
  const res = await fetch("/api/auth/wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Could not verify device");
}

export function BackendSessionSync() {
  const { ready, authenticated, walletAddress } = useCurrentWallet();
  const syncing = useRef(false);
  const syncedAddress = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function syncSession() {
      if (!ready) return;

      if (!authenticated) {
        syncedAddress.current = null;
        syncing.current = false;
        return;
      }

      if (!walletAddress || syncing.current || syncedAddress.current === walletAddress) {
        return;
      }

      syncing.current = true;
      try {
        await syncWalletSession(walletAddress);
        if (mounted) syncedAddress.current = walletAddress;
      } catch {
        if (mounted) syncedAddress.current = null;
      } finally {
        syncing.current = false;
      }
    }

    void syncSession();
    return () => {
      mounted = false;
    };
  }, [authenticated, ready, walletAddress]);

  return null;
}
