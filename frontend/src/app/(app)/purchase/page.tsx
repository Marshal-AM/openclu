"use client";

import { useState } from "react";

type QueryMatch = {
  score: number;
  skillName: string;
  title: string;
  description: string;
  triggers: string[];
  listingKey: string;
  status: string;
};

export default function PurchasePage() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [minScore, setMinScore] = useState("0");
  const [skillSlug, setSkillSlug] = useState("");
  const [scope, setScope] = useState<"marketplace" | "mine">("marketplace");
  const [matches, setMatches] = useState<QueryMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  async function runSearch() {
    setLoading(true);
    setError("");
    setDetail(null);
    try {
      const body: Record<string, unknown> = {
        query: query.trim() || undefined,
        tag: tag.trim() || undefined,
        status: status || undefined,
        since: since ? Date.parse(since) : undefined,
        until: until ? Date.parse(until) : undefined,
        minScore: Number(minScore) || 0,
        skillSlug: skillSlug.trim() || undefined,
        scope,
      };
      const res = await fetch("/api/catalog/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setMatches(data.matches ?? []);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMatches([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(name: string) {
    const res = await fetch(`/api/catalog/${encodeURIComponent(name)}`);
    if (res.ok) setDetail(await res.json());
  }

  function onFilterKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void runSearch();
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold">Purchase Agent Skills</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Set filters, then click Search to query the Arkiv catalog.
      </p>

      <div className="mt-6 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <input
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          placeholder="Keyword search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onFilterKeyDown}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={onFilterKeyDown}
          />
          <select
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Any status</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
          <input
            type="datetime-local"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
          <input
            type="datetime-local"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
          <input
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Skill slug"
            value={skillSlug}
            onChange={(e) => setSkillSlug(e.target.value)}
            onKeyDown={onFilterKeyDown}
          />
          <input
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Min score"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            onKeyDown={onFilterKeyDown}
          />
          <select
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm sm:col-span-2"
            value={scope}
            onChange={(e) => setScope(e.target.value as "marketplace" | "mine")}
          >
            <option value="marketplace">Marketplace (all listings)</option>
            <option value="mine">My listings only</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {!searched && !loading && (
        <p className="mt-6 text-sm text-zinc-500">No search yet — adjust filters and click Search.</p>
      )}

      {searched && !loading && !error && matches.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500">No skills matched your filters.</p>
      )}

      <ul className="mt-6 space-y-3">
        {matches.map((m) => (
          <li
            key={m.listingKey}
            className="cursor-pointer rounded-xl border border-zinc-800 p-4 hover:border-emerald-800/50"
            onClick={() => openDetail(m.skillName)}
          >
            <div className="flex justify-between gap-2">
              <h3 className="font-medium">{m.title}</h3>
              <span className="text-xs text-zinc-500">score {(m.score * 100).toFixed(0)}%</span>
            </div>
            <p className="mt-1 text-sm text-zinc-400 line-clamp-2">{m.description}</p>
            <p className="mt-2 font-mono text-xs text-zinc-600">{m.skillName}</p>
          </li>
        ))}
      </ul>

      {detail && (
        <pre className="mt-6 max-h-96 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs">
          {JSON.stringify(detail, null, 2)}
        </pre>
      )}
    </div>
  );
}
