"use client";

import { PrivyProvider, type PrivyClientConfig } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { WagmiProvider } from "wagmi";
import { BackendSessionSync } from "@/components/auth/backend-session-sync";
import { CurrentWalletProvider } from "@/components/auth/current-wallet";
import { wagmiConfig } from "@/lib/wagmi-config";

function privyConfigForContext(secureContext: boolean): PrivyClientConfig {
  // Embedded wallets need a secure context (HTTPS). http://localhost is allowed;
  // http://100.x.x.x (Tailscale/LAN) is not — use localhost or HTTPS in dev.
  if (!secureContext) {
    // Do not enable embedded wallet features on http:// LAN/Tailscale IPs.
    return {};
  }
  return {
    embeddedWallets: {
      ethereum: { createOnLogin: "users-without-wallets" },
    },
  };
}

export function OpenCluWeb3Provider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const [secureContext, setSecureContext] = useState<boolean | null>(null);
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? "";
  const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID?.trim();

  useEffect(() => {
    setSecureContext(window.isSecureContext);
  }, []);

  const privyConfig = useMemo(
    () => privyConfigForContext(secureContext ?? false),
    [secureContext],
  );

  if (!appId) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div className="max-w-xl rounded-lg border bg-card p-5 text-sm text-card-foreground">
          Missing <span className="font-mono">NEXT_PUBLIC_PRIVY_APP_ID</span>.
        </div>
      </div>
    );
  }

  if (secureContext === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId || undefined}
      config={privyConfig}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={client}>
          <CurrentWalletProvider>
            <BackendSessionSync />
            {children}
          </CurrentWalletProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
