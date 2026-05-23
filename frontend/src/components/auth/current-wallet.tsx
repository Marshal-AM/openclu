"use client";

import type { ConnectedWallet } from "@privy-io/react-auth";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createContext, useCallback, useContext, useMemo } from "react";
import { primaryPrivyWalletAddress } from "@/lib/privy-user";

type CurrentWalletContextValue = {
  ready: boolean;
  authenticated: boolean;
  walletAddress: string | null;
  wallets: ConnectedWallet[];
  signOut: () => Promise<void>;
};

const CurrentWalletContext = createContext<CurrentWalletContextValue | null>(null);

export function CurrentWalletProvider({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = primaryPrivyWalletAddress(user, wallets);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    if (authenticated) {
      await logout();
    }
  }, [authenticated, logout]);

  const value = useMemo<CurrentWalletContextValue>(
    () => ({
      ready,
      authenticated,
      walletAddress,
      wallets,
      signOut,
    }),
    [authenticated, ready, signOut, walletAddress, wallets],
  );

  return <CurrentWalletContext.Provider value={value}>{children}</CurrentWalletContext.Provider>;
}

export function useCurrentWallet() {
  const context = useContext(CurrentWalletContext);
  if (!context) {
    throw new Error("useCurrentWallet must be used within CurrentWalletProvider");
  }
  return context;
}
