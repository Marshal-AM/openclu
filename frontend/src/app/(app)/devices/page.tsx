"use client";

import { useEffect, useState } from "react";

type Device = {
  device_id: string;
  device_name: string;
  wallet_address: string;
  orchestrator_url: string | null;
  registered_at: string | null;
};

export default function DevicesPage() {
  const [device, setDevice] = useState<Device | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/devices/me")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setDevice(data.device);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold">My Devices</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Device registered via <code className="text-emerald-400">register.sh</code> on this machine.
      </p>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {device && (
        <dl className="mt-6 space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-sm">
          <div>
            <dt className="text-zinc-500">Name</dt>
            <dd className="font-medium">{device.device_name}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Device ID</dt>
            <dd className="font-mono text-xs">{device.device_id}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Wallet</dt>
            <dd className="break-all font-mono text-emerald-300">{device.wallet_address}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Orchestrator tunnel</dt>
            <dd className="break-all font-mono text-xs text-emerald-300/90">
              {device.orchestrator_url ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Registered</dt>
            <dd>{device.registered_at ? new Date(device.registered_at).toLocaleString() : "—"}</dd>
          </div>
        </dl>
      )}
      <p className="mt-6 text-sm text-zinc-500">
        Orchestrator URL is refreshed from Supabase whenever you open any app page. After changing ngrok,
        update <code className="text-zinc-400">devices.orchestrator_url</code> in Supabase or re-run{" "}
        <code className="text-zinc-400">register.ps1</code> and confirm registration.
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        To register a new device, run{" "}
        <code className="text-zinc-300">./register.sh</code> from skill-capture and scan the QR code.
      </p>
    </div>
  );
}
