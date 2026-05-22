"use client";

import { useState } from "react";
import { CatalogDetailPanel } from "@/components/CatalogDetailPanel";

type QueryMatch = {
  score: number;
  skillName: string;
  title: string;
  description: string;
  triggers: string[];
  listingKey: string;
  status: string;
  owner?: string;
  creator?: string;
  arkivVersion?: number;
  tags?: string[];
  payload?: Record<string, unknown>;
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
  const [detailLoading, setDetailLoading] = useState(false);
  const [showFullBrowse, setShowFullBrowse] = useState(false);

  async function runSearch(opts?: { full?: boolean; emptyQuery?: boolean }) {
    setLoading(true);
    setError("");
    if (!opts?.full) setDetail(null);
    try {
      const body: Record<string, unknown> = {
        query: opts?.emptyQuery ? "" : query.trim() || undefined,
        tag: tag.trim() || undefined,
        status: status || undefined,
        since: since ? Date.parse(since) : undefined,
        until: until ? Date.parse(until) : undefined,
        minScore: Number(minScore) || 0,
        skillSlug: skillSlug.trim() || undefined,
        scope,
        full: opts?.full ?? false,
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
      if (opts?.full) setShowFullBrowse(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMatches([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(name: string) {
    setDetailLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/catalog/${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load listing");
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
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
        Browse the Arkiv catalog. Detail view shows full metadata, purchase block, ops, tags, and
        version.
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
            <option value="marketplace">Marketplace (published only)</option>
            <option value="mine">My listings only</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "Searching…" : "Search"}
          </button>
          <button
            type="button"
            onClick={() => void runSearch({ full: true, emptyQuery: true })}
            disabled={loading}
            className="rounded-lg border border-zinc-600 px-4 py-2.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Browse entire catalog"}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {!searched && !loading && (
        <p className="mt-6 text-sm text-zinc-500">
          Search by keyword or click Browse entire catalog to load all published listings with full
          payloads.
        </p>
      )}

      {searched && !loading && !error && matches.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500">No skills matched your filters.</p>
      )}

      {searched && matches.length > 0 && (
        <p className="mt-6 text-sm text-zinc-500">
          {matches.length} listing{matches.length === 1 ? "" : "s"}
          {showFullBrowse ? " (full catalog rows)" : ""}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {matches.map((m) => (
          <li
            key={m.listingKey}
            className="rounded-xl border border-zinc-800 p-4 hover:border-emerald-800/50"
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => void openDetail(m.skillName)}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-medium">{m.title}</h3>
                <span className="text-xs text-zinc-500">
                  {m.status}
                  {m.arkivVersion != null ? ` · v${m.arkivVersion}` : ""}
                  {query.trim() ? ` · score ${(m.score * 100).toFixed(0)}%` : ""}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-400 line-clamp-2">{m.description}</p>
              <p className="mt-2 font-mono text-xs text-zinc-600">{m.skillName}</p>
            </button>
            {showFullBrowse && m.payload && (
              <details className="mt-3 border-t border-zinc-800 pt-3">
                <summary className="cursor-pointer text-xs text-zinc-500">
                  Inline full payload
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-zinc-900 p-2 text-[10px]">
                  {JSON.stringify(
                    {
                      entityKey: m.listingKey,
                      status: m.status,
                      owner: m.owner,
                      creator: m.creator,
                      arkivVersion: m.arkivVersion,
                      tags: m.tags,
                      payload: m.payload,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ul>

      {detailLoading && (
        <p className="mt-6 text-sm text-zinc-500">Loading full catalog entry…</p>
      )}
      {detail && !detailLoading && (
        <CatalogDetailPanel detail={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
