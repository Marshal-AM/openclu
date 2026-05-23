"use client";

import { useCallback, useEffect, useState } from "react";
import { useDeviceInteractionStore } from "@/lib/device-interaction-store";
import type { OwnedDevice } from "@/lib/device-types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  const chooseDevice = useDeviceInteractionStore((s) => s.chooseDevice);
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

  function selectDevice(deviceId: string) {
    chooseDevice(deviceId);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Devices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Devices registered via <code className="text-foreground">register.sh</code>. Choose the
          one you want to use for capture/publish actions.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load devices</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

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
              <CardFooter>
                <Button
                  type="button"
                  variant={isSelected ? "secondary" : "outline"}
                  className="w-full"
                  onClick={(event) => {
                    event.stopPropagation();
                    selectDevice(device.id);
                  }}
                >
                  {isSelected ? "Currently selected" : "Use this device"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedDevice} onOpenChange={(open) => !open && setSelectedDevice(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedDevice?.device_name ?? "Device"}</DialogTitle>
            <DialogDescription>Registered device details.</DialogDescription>
          </DialogHeader>
          {selectedDevice ? (
            <dl className="grid gap-5 text-sm">
              <div>
                <dt className="text-muted-foreground">Device row ID</dt>
                <dd className="break-all font-mono text-xs">{selectedDevice.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Device ID</dt>
                <dd className="break-all font-mono text-xs">{selectedDevice.device_id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Device wallet</dt>
                <dd className="break-all font-mono text-xs">{selectedDevice.wallet_address}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Orchestrator tunnel</dt>
                <dd className="break-all font-mono text-xs">
                  {selectedDevice.orchestrator_url ?? "Unavailable"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Registered</dt>
                <dd>
                  {selectedDevice.registered_at
                    ? new Date(selectedDevice.registered_at).toLocaleString()
                    : "Unavailable"}
                </dd>
              </div>
              <div>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => selectDevice(selectedDevice.id)}
                >
                  Use this device for contribution flow
                </Button>
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => clearDeviceSelection()}>
              Clear selected context
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
