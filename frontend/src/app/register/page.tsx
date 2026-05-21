"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";

function RegisterForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const address = params.get("address") ?? "";
  const deviceName = params.get("deviceName") ?? "";
  const deviceId = params.get("deviceId") ?? "";
  const orchestratorUrl = params.get("orchestratorUrl") ?? "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function confirm() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, address, deviceName, deviceId, orchestratorUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-2xl font-semibold">Register device</h1>
        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-500">Device</dt>
            <dd className="font-medium">{deviceName || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Wallet</dt>
            <dd className="break-all font-mono text-emerald-300">{address || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Orchestrator (your machine)</dt>
            <dd className="break-all font-mono text-xs text-zinc-300">
              {orchestratorUrl || "—"}
            </dd>
          </div>
        </dl>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        <button
          type="button"
          onClick={confirm}
          disabled={loading || !token || !address || !orchestratorUrl}
          className="mt-6 w-full rounded-lg bg-emerald-600 py-2.5 font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Confirming…" : "Confirm registration"}
        </button>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-400">Loading…</div>}>
      <RegisterForm />
    </Suspense>
  );
}
