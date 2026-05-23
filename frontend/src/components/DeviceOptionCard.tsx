"use client";

import { SmartphoneIcon } from "lucide-react";
import type { OwnedDevice } from "@/lib/device-types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type DeviceOptionCardProps = {
  device: OwnedDevice;
  isCurrent: boolean;
  isChosen: boolean;
  onChoose: () => void;
  onSelect: () => Promise<void> | void;
};

function shortWallet(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function DeviceOptionCard({
  device,
  isCurrent,
  isChosen,
  onChoose,
  onSelect,
}: DeviceOptionCardProps) {
  const missingOrchestrator = !device.orchestrator_url;

  return (
    <Card
      size="sm"
      role="button"
      tabIndex={0}
      className={cn(
        "grid h-[140px] w-full cursor-pointer grid-rows-[1fr_auto] rounded-xl bg-card p-4 shadow-sm ring-1 ring-border/80 transition-all",
        isChosen ? "bg-primary/15 ring-primary/40 shadow-md" : "hover:bg-muted/35",
      )}
      onClick={onChoose}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onChoose();
        }
      }}
    >
      <div className="flex min-w-0 flex-col items-center justify-center self-center text-center">
        <div className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
          <SmartphoneIcon className="size-5" />
        </div>
        <div className="mt-3 min-w-0 max-w-full">
          <p className="truncate text-base font-semibold leading-5">{device.device_name}</p>
          <p className="mt-1 truncate text-xs leading-4 text-muted-foreground">
            Wallet {shortWallet(device.wallet_address)}
          </p>
          <div className="mt-2 flex min-h-5 flex-wrap justify-center gap-1.5">
            {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
            {missingOrchestrator ? <Badge variant="destructive">Missing URL</Badge> : null}
          </div>
        </div>
      </div>

      <div className="mt-3 h-7">
        <Button
          type="button"
          size="sm"
          className="h-7 w-full"
          disabled={missingOrchestrator}
          onClick={(event) => {
            event.stopPropagation();
            void onSelect();
          }}
        >
          {isCurrent ? "Selected" : isChosen ? "Use this device" : "Select device"}
        </Button>
      </div>
    </Card>
  );
}
