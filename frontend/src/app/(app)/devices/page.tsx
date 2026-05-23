"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClockIcon, FingerprintIcon, IdCardIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { useDeviceInteractionStore } from "@/lib/device-interaction-store";
import type { OwnedDevice } from "@/lib/device-types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const selectedDeviceId = useDeviceInteractionStore((s) => s.selectedDeviceId);
  const clearDeviceSelection = useDeviceInteractionStore((s) => s.clearDeviceSelection);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/devices");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load devices");
      const list = (data.devices ?? []) as OwnedDevice[];
      setDevices(list);
      if (selectedDeviceId && !list.some((d) => d.id === selectedDeviceId)) {
        clearDeviceSelection();
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [clearDeviceSelection, selectedDeviceId]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    if (!error) return;
    toast.error("Could not load devices", { description: error });
  }, [error]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Devices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Devices registered via <code className="text-foreground">register.sh</code>. Choose the
          one you want to use for capture/publish actions.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
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

      <div className="grid gap-4 sm:grid-cols-2">
        {devices.map((device) => {
          const isSelected = selectedDeviceId === device.id;
          return (
            <Card
              key={device.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer transition-colors hover:bg-muted/40"
              onClick={() => setSelectedDevice(device)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedDevice(device);
                }
              }}
            >
              <CardHeader>
                <CardTitle>{device.device_name}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  {isSelected ? <Badge variant="secondary">Selected for recording</Badge> : null}
                  {!device.orchestrator_url ? (
                    <Badge variant="destructive">Missing orchestrator URL</Badge>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Device wallet</dt>
                    <dd className="truncate font-mono text-xs">{device.wallet_address}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Registered</dt>
                    <dd>
                      {device.registered_at
                        ? new Date(device.registered_at).toLocaleString()
                        : "Unavailable"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
