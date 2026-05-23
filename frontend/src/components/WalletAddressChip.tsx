"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { shortAddress } from "@/lib/privy-user";
import { cn } from "@/lib/utils";

type WalletAddressChipProps = {
  address: string | null | undefined;
  className?: string;
};

const chipClassName =
  "cursor-pointer rounded-full border bg-background px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground";

export function WalletAddressChip({ address, className }: WalletAddressChipProps) {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Wallet address copied.");
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
      toast.error("Could not copy wallet address.");
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void copyAddress();
    }
  }

  if (!address) {
    return (
      <div className={cn(chipClassName, "cursor-default hover:border-border hover:text-muted-foreground", className)}>
        Not connected
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => void copyAddress()}
      onKeyDown={onKeyDown}
      title="Click to copy wallet address"
      className={cn(chipClassName, copied ? "inline-flex items-center gap-1" : undefined, className)}
    >
      {copied ? <CheckIcon className="size-3 shrink-0 text-primary" aria-hidden /> : null}
      {copied ? "Copied" : shortAddress(address)}
    </div>
  );
}
