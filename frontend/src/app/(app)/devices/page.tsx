"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClockIcon, FingerprintIcon, IdCardIcon, WalletIcon } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-xl" />
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedDevice?.device_name ?? "Device"}</DialogTitle>
            <DialogDescription>Registered device details.</DialogDescription>
          </DialogHeader>
          {selectedDevice ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/25 p-4">
                <dt className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <FingerprintIcon className="size-4" />
                  Device Row ID
                </dt>
                <dd className="break-all font-mono text-xs">{selectedDevice.id}</dd>
              </div>
              <div className="rounded-xl border bg-muted/25 p-4">
                <dt className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <IdCardIcon className="size-4" />
                  Device ID
                </dt>
                <dd className="break-all font-mono text-xs">{selectedDevice.device_id}</dd>
              </div>
              <div className="rounded-xl border bg-muted/25 p-4">
                <dt className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <WalletIcon className="size-4" />
                  Device Wallet
                </dt>
                <dd className="break-all font-mono text-xs">{selectedDevice.wallet_address}</dd>
              </div>
              <div className="rounded-xl border bg-muted/25 p-4">
                <dt className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <CalendarClockIcon className="size-4" />
                  Registered
                </dt>
                <dd className="text-sm">
                  {selectedDevice.registered_at
                    ? new Date(selectedDevice.registered_at).toLocaleString()
                    : "Unavailable"}
                </dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
