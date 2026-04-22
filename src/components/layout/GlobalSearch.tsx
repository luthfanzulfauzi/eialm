"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Building2,
  Clock3,
  Database,
  KeyRound,
  Loader2,
  Search,
  Server,
  Shield,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SearchScope = "all" | "assets" | "licenses" | "ips" | "products" | "locations" | "maintenance";

type SearchResult = {
  id: string;
  type: SearchScope;
  title: string;
  subtitle?: string;
  href: string;
  badge?: string;
};

type SearchResponse = {
  query: string;
  results: SearchResult[];
};

const scopeOptions: Array<{ key: SearchScope; label: string }> = [
  { key: "all", label: "All" },
  { key: "assets", label: "Assets" },
  { key: "licenses", label: "Licenses" },
  { key: "ips", label: "IPs" },
  { key: "products", label: "Products" },
  { key: "locations", label: "Locations" },
  { key: "maintenance", label: "Maintenance" },
];

const iconByType: Record<SearchScope, typeof Search> = {
  all: Search,
  assets: Server,
  licenses: KeyRound,
  ips: Shield,
  products: Boxes,
  locations: Building2,
  maintenance: Wrench,
};

const typeLabel: Record<SearchScope, string> = {
  all: "Result",
  assets: "Asset",
  licenses: "License",
  ips: "IP Address",
  products: "Product",
  locations: "Location",
  maintenance: "Maintenance",
};

export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const trimmedQuery = query.trim();

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open || trimmedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ q: trimmedQuery, scope });
        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => ({}))) as Partial<SearchResponse>;
        setResults(Array.isArray(payload.results) ? payload.results : []);
      } catch (error) {
        if ((error as any)?.name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, scope, trimmedQuery]);

  const groupedResults = useMemo(() => {
    return results.reduce<Record<string, SearchResult[]>>((acc, result) => {
      const label = typeLabel[result.type] || "Result";
      acc[label] = acc[label] || [];
      acc[label].push(result);
      return acc;
    }, {});
  }, [results]);

  const openResult = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full max-w-md items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-left text-sm text-slate-500 transition-colors hover:border-slate-500"
      >
        <Search size={16} />
        <span className="flex-1">Search assets, licenses, IPs...</span>
        <kbd className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
          Cmd K
        </kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90] bg-black/60 px-4 py-20 backdrop-blur-sm" onMouseDown={close}>
          <div
            className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-slate-700 bg-[#111620] shadow-2xl shadow-black/50"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
              <Search size={18} className="text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, serial number, license key, IP address..."
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
              />
              {loading ? <Loader2 size={16} className="animate-spin text-slate-500" /> : null}
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Close search"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto border-b border-slate-800 px-4 py-3">
              {scopeOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setScope(option.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                    scope === option.key
                      ? "border-blue-500/40 bg-blue-500/15 text-blue-200"
                      : "border-slate-800 bg-slate-900/60 text-slate-500 hover:text-slate-200"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              {trimmedQuery.length < 2 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <Database size={28} className="mb-3 text-slate-600" />
                  <div className="text-sm font-bold text-slate-300">Start with at least two characters.</div>
                  <div className="mt-1 text-xs text-slate-600">Global search covers assets, licenses, IPs, products, locations, and repair work.</div>
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <Clock3 size={28} className="mb-3 text-slate-600" />
                  <div className="text-sm font-bold text-slate-300">No matching records found.</div>
                  <div className="mt-1 text-xs text-slate-600">Try a serial number, IP address, product code, or location name.</div>
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.entries(groupedResults).map(([group, groupResults]) => (
                    <div key={group}>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                        {group}
                      </div>
                      <div className="space-y-2">
                        {groupResults.map((result) => {
                          const Icon = iconByType[result.type] ?? Search;
                          return (
                            <Link
                              key={`${result.type}-${result.id}`}
                              href={result.href}
                              onClick={close}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") openResult(result.href);
                              }}
                              className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 transition-colors hover:border-blue-500/40 hover:bg-blue-500/10"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-400">
                                <Icon size={17} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-bold text-white">{result.title}</div>
                                {result.subtitle ? (
                                  <div className="truncate text-xs text-slate-500">{result.subtitle}</div>
                                ) : null}
                              </div>
                              {result.badge ? (
                                <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                                  {result.badge}
                                </span>
                              ) : null}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
