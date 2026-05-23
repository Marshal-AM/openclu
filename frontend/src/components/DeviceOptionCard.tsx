"use client";

import { SmartphoneIcon } from "lucide-react";
import type { OwnedDevice } from "@/lib/device-types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type DeviceOptionCardProps = {
  device: OwnedDevice;
  size?: "sm" | "lg";
  mode?: "select" | "static";
  isCurrent?: boolean;
  isChosen?: boolean;
  onChoose?: () => void;
  onSelect?: () => Promise<void> | void;
};

function shortWallet(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function DeviceOptionCard({
  device,
  size = "sm",
  mode = "select",
  isCurrent = false,
  isChosen = false,
  onChoose,
  onSelect,
}: DeviceOptionCardProps) {
  const missingOrchestrator = !device.orchestrator_url;
  const isLarge = size === "lg";
  const interactive = Boolean(onChoose);

  return (
    <Card
      size="sm"
      tabIndex={interactive ? 0 : undefined}
      className={cn(
        "flex w-full min-h-0 flex-col overflow-visible rounded-xl bg-card shadow-sm ring-1 ring-border/80 transition-all",
        isLarge ? "gap-2.5 p-5" : "gap-1.5 p-3",
        interactive && "cursor-pointer",
        isChosen ? "bg-primary/15 ring-primary/40 shadow-md" : interactive && "hover:bg-muted/35",
      )}
      onClick={onChoose}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onChoose?.();
              }
            }
          : undefined
      }
    >
      <div className="flex min-w-0 items-center gap-2.5 text-left">
        <div
          className={cn(
            "grid shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground",
            isLarge ? "size-12" : "size-8",
          )}
        >
          <SmartphoneIcon className={isLarge ? "size-6" : "size-4"} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-semibold leading-tight", isLarge ? "text-base" : "text-sm")}>
            {device.device_name}
          </p>
          <p className={cn("truncate text-muted-foreground", isLarge ? "mt-1 text-xs" : "mt-0.5 text-[11px]")}>
            Wallet {shortWallet(device.wallet_address)}
          </p>
          {(isCurrent || missingOrchestrator) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
              {missingOrchestrator ? <Badge variant="destructive">Missing URL</Badge> : null}
            </div>
          )}
        </div>
      </div>

      {mode === "select" && isChosen ? (
        <div className="shrink-0 pt-0.5">
          <Button
            type="button"
            variant="default"
            size="sm"
            className={cn(
              "w-full bg-primary text-primary-foreground hover:bg-primary/90",
              isLarge ? "h-9" : "h-7",
            )}
            disabled={missingOrchestrator || isCurrent}
            onClick={(event) => {
              event.stopPropagation();
              void onSelect?.();
            }}
          >
            {isCurrent ? "Selected" : "Select"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
