"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClockIcon,
  CheckIcon,
  FingerprintIcon,
  GlobeIcon,
  IdCardIcon,
  ServerIcon,
  UserIcon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";
import { DeviceOptionCard } from "@/components/DeviceOptionCard";
import type { OwnedDevice } from "@/lib/device-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function CopyableValue({
  value,
  mono = true,
  className,
}: {
  value: string;
  mono?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title="Click to copy"
      className={cn(
        "group inline-flex w-full items-center gap-2 rounded-md text-left transition-colors hover:text-primary",
        className,
      )}
    >
      <span className={cn("min-w-0 flex-1 break-all", mono ? "font-mono text-xs" : "text-sm")}>{value}</span>
      {copied ? (
        <CheckIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
      ) : (
        <span className="shrink-0 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          Copy
        </span>
      )}
    </button>
  );
}

function DetailField({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-muted/25 p-4", className)}>
      <dt className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "Unavailable";
  return new Date(value).toLocaleString();
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<OwnedDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<OwnedDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/devices");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load devices");
      setDevices((data.devices ?? []) as OwnedDevice[]);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    if (!error) return;
    toast.error("Could not load devices", { description: error });
  }, [error]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Devices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Devices registered via <code className="text-foreground">register.sh</code>. Select a
          card to view device details.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : null}

      {!loading && devices.length === 0 && !error ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No devices registered</EmptyTitle>
            <EmptyDescription>
              Run register.sh/register.ps1 from skill-capture and confirm the registration link.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!loading && devices.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => (
            <DeviceOptionCard
              key={device.id}
              device={device}
              size="lg"
              mode="static"
              onChoose={() => setSelectedDevice(device)}
            />
          ))}
        </div>
      ) : null}

      <Dialog open={!!selectedDevice} onOpenChange={(open) => !open && setSelectedDevice(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedDevice?.device_name ?? "Device"}</DialogTitle>
            <DialogDescription>Registered device details.</DialogDescription>
          </DialogHeader>
          {selectedDevice ? (
            <div className="flex flex-col gap-5">
              <section className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Identity</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <DetailField icon={FingerprintIcon} label="Device row ID">
                    <CopyableValue value={selectedDevice.id} />
                  </DetailField>
                  <DetailField icon={IdCardIcon} label="Device ID">
                    <CopyableValue value={selectedDevice.device_id} />
                  </DetailField>
                </dl>
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Wallets</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <DetailField icon={WalletIcon} label="Device wallet">
                    <CopyableValue value={selectedDevice.wallet_address} />
                  </DetailField>
                  <DetailField icon={UserIcon} label="Owner wallet">
                    <CopyableValue value={selectedDevice.owner_wallet_address} />
                  </DetailField>
                </dl>
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Connection</h3>
                <dl className="grid gap-3">
                  <DetailField icon={ServerIcon} label="Portal URL">
                    {selectedDevice.orchestrator_url ? (
                      <CopyableValue value={selectedDevice.orchestrator_url} mono={false} />
                    ) : (
                      <span className="text-sm text-muted-foreground">Not configured</span>
                    )}
                  </DetailField>
                </dl>
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Timestamps</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <DetailField icon={CalendarClockIcon} label="Registered">
                    <span className="text-sm">{formatDateTime(selectedDevice.registered_at)}</span>
                  </DetailField>
                  <DetailField icon={GlobeIcon} label="Created in database">
                    <span className="text-sm">{formatDateTime(selectedDevice.created_at)}</span>
                  </DetailField>
                </dl>
              </section>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
