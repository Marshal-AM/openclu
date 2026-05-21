"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/contribute", label: "Contribute Agent Skills" },
  { href: "/purchase", label: "Purchase Agent Skills" },
  { href: "/devices", label: "My Devices" },
];

export function AppShell({
  children,
  orchestratorUrl,
}: {
  children: React.ReactNode;
  orchestratorUrl?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-900 p-4">
        <p className="mb-6 text-lg font-semibold tracking-tight">Skill Capture</p>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                pathname === item.href
                  ? "bg-emerald-600/20 text-emerald-300"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {orchestratorUrl ? (
          <p className="mt-6 text-xs text-zinc-500">
            Orchestrator
            <span className="mt-1 block break-all font-mono text-[10px] text-emerald-400/80">
              {orchestratorUrl}
            </span>
            <span className="mt-1 block text-[10px] text-zinc-600">Loaded from Supabase on each page</span>
          </p>
        ) : null}
        <button
          type="button"
          onClick={logout}
          className="mt-8 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:border-zinc-500"
        >
          Log out
        </button>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
