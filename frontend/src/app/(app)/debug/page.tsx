"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WrenchIcon } from "lucide-react";
import { toast } from "sonner";
import { DeviceOptionCard } from "@/components/DeviceOptionCard";
import { WalletAddressChip } from "@/components/WalletAddressChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { OwnedDevice } from "@/lib/device-types";

type DeviceForm = {
  deviceName: string;
  deviceId: string;
  walletAddress: string;
  orchestratorUrl: string;
  registrationToken: string;
  registeredAt: string;
};

function toLocalDatetimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalDatetimeInput(value: string): string | null {
  if (!value.trim()) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function deviceToForm(device: OwnedDevice): DeviceForm {
  return {
    deviceName: device.device_name,
    deviceId: device.device_id,
    walletAddress: device.wallet_address,
    orchestratorUrl: device.orchestrator_url ?? "",
    registrationToken: device.registration_token ?? "",
    registeredAt: toLocalDatetimeInput(device.registered_at),
  };
}

export default function DebugPage() {
  const [devices, setDevices] = useState<OwnedDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<DeviceForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedId) ?? null,
    [devices, selectedId],
  );

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/devices");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load devices");
      const list = (data.devices ?? []) as OwnedDevice[];
      setDevices(list);
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

  function selectDevice(device: OwnedDevice) {
    setSelectedId(device.id);
    setForm(deviceToForm(device));
  }

  function updateField<K extends keyof DeviceForm>(key: K, value: DeviceForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function applyChanges() {
    if (!selectedDevice || !form) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(selectedDevice.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceName: form.deviceName,
          deviceId: form.deviceId,
          walletAddress: form.walletAddress,
          orchestratorUrl: form.orchestratorUrl.trim() ? form.orchestratorUrl.trim() : null,
          registrationToken: form.registrationToken.trim() ? form.registrationToken.trim() : null,
          registeredAt: fromLocalDatetimeInput(form.registeredAt),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Could not update device");
      }

      const updated = (data as { device: OwnedDevice }).device;
      setDevices((current) => current.map((d) => (d.id === updated.id ? updated : d)));
      setForm(deviceToForm(updated));
      toast.success("Device updated on catalog", {
        description: updated.device_name,
      });
    } catch (e) {
      toast.error("Update failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <WrenchIcon className="size-5 text-muted-foreground" aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight">Device debug</h1>
            <Badge variant="secondary">Catalog portal</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pick a registered device and edit its portal record directly — useful when ngrok
            rotates and you need a new orchestrator URL without re-running{" "}
            <code className="text-foreground">register.sh</code>.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadDevices()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Choose device</CardTitle>
            <CardDescription>Registered devices for your session wallet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : null}

            {!loading && devices.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No devices</EmptyTitle>
                  <EmptyDescription>Register a device first, then return here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}

            {!loading && devices.length > 0 ? (
              <div className="space-y-2">
                {devices.map((device) => (
                  <DeviceOptionCard
                    key={device.id}
                    device={device}
                    mode="select"
                    isChosen={device.id === selectedId}
                    onChoose={() => selectDevice(device)}
                  />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Edit device</CardTitle>
            <CardDescription>
              Changes write to Catalog via the portal wallet. Requires{" "}
              <code className="text-foreground">PORTAL_WALLET_PRIVATE_KEY</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedDevice || !form ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Select a device</EmptyTitle>
                  <EmptyDescription>Choose a device on the left to edit its fields.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl border bg-muted/25 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Portal row ID
                  </p>
                  <p className="mt-1 break-all font-mono text-xs">{selectedDevice.id}</p>
                  <div className="mt-3">
                    <WalletAddressChip address={selectedDevice.owner_wallet_address} />
                  </div>
                </div>

                <Separator />

                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="debug-device-name">Device name</FieldLabel>
                    <Input
                      id="debug-device-name"
                      value={form.deviceName}
                      onChange={(e) => updateField("deviceName", e.target.value)}
                      placeholder="My capture laptop"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="debug-device-id">Device ID</FieldLabel>
                    <Input
                      id="debug-device-id"
                      value={form.deviceId}
                      onChange={(e) => updateField("deviceId", e.target.value)}
                      placeholder="machine-id from register.sh"
                      className="font-mono text-sm"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="debug-wallet">Device wallet</FieldLabel>
                    <Input
                      id="debug-wallet"
                      value={form.walletAddress}
                      onChange={(e) => updateField("walletAddress", e.target.value)}
                      placeholder="0x..."
                      className="font-mono text-sm"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="debug-orchestrator-url">Orchestrator / portal URL</FieldLabel>
                    <Input
                      id="debug-orchestrator-url"
                      value={form.orchestratorUrl}
                      onChange={(e) => updateField("orchestratorUrl", e.target.value)}
                      placeholder="https://abc123.ngrok-free.app"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="debug-registration-token">Registration token</FieldLabel>
                    <Input
                      id="debug-registration-token"
                      value={form.registrationToken}
                      onChange={(e) => updateField("registrationToken", e.target.value)}
                      placeholder="Optional"
                      className="font-mono text-sm"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="debug-registered-at">Registered at</FieldLabel>
                    <Input
                      id="debug-registered-at"
                      type="datetime-local"
                      value={form.registeredAt}
                      onChange={(e) => updateField("registeredAt", e.target.value)}
                    />
                  </Field>
                </FieldGroup>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void applyChanges()} disabled={saving}>
                    {saving ? "Saving…" : "Change"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => setForm(deviceToForm(selectedDevice))}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
