"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldCheck, AlertTriangle, X } from "lucide-react";

interface ControlResult {
  controlId: string;
  controlRef: string;
  category: string;
  framework: string;
}
interface IncidentResult {
  id: string;
  title: string;
  severity: string;
  status: string;
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [controls, setControls] = useState<ControlResult[]>([]);
  const [incidents, setIncidents] = useState<IncidentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K opens and focuses search from anywhere on the page.
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  // Click outside closes the results dropdown.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced fetch as the person types.
  useEffect(() => {
    if (query.trim().length < 2) {
      setControls([]);
      setIncidents([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((json) => {
          setControls(json.data?.controls ?? []);
          setIncidents(json.data?.incidents ?? []);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function goToControl(controlId: string) {
    setOpen(false);
    setQuery("");
    router.push(`/controls?highlight=${controlId}`);
  }

  function goToIncidents() {
    setOpen(false);
    setQuery("");
    router.push("/incidents");
  }

  const hasResults = controls.length > 0 || incidents.length > 0;
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex items-center gap-2 rounded-[var(--radius)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-2.5 py-1.5 text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--border))]"
      >
        <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
        {open ? (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search controls, incidents…"
            className="w-48 bg-transparent text-[12px] text-[hsl(var(--text-primary))] outline-none placeholder:text-[hsl(var(--text-tertiary))]"
          />
        ) : (
          <span className="text-[12px]">Search controls, incidents…</span>
        )}
        {open && query ? (
          <X
            className="h-3 w-3 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
              inputRef.current?.focus();
            }}
          />
        ) : (
          <kbd className="ml-6 rounded border border-[hsl(var(--border))] px-1 text-[10px] text-[hsl(var(--text-tertiary))]">⌘K</kbd>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[360px] overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] shadow-2xl">
          {loading ? (
            <div className="px-3 py-4 text-center text-[12px] text-[hsl(var(--text-tertiary))]">Searching…</div>
          ) : !hasResults ? (
            <div className="px-3 py-4 text-center text-[12px] text-[hsl(var(--text-tertiary))]">No matches for "{query}"</div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto py-1.5">
              {controls.length > 0 && (
                <div className="px-1.5">
                  <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">Controls</div>
                  {controls.map((c) => (
                    <button
                      key={c.controlId}
                      onClick={() => goToControl(c.controlId)}
                      className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left hover:bg-[hsl(var(--surface-2))]"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 flex-none text-[hsl(var(--accent))]" />
                      <div className="min-w-0">
                        <div className="truncate text-[12px] text-[hsl(var(--text-primary))]">
                          {c.controlRef} <span className="text-[hsl(var(--text-tertiary))]">· {c.framework}</span>
                        </div>
                        <div className="truncate text-[10.5px] text-[hsl(var(--text-tertiary))]">{c.category}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {incidents.length > 0 && (
                <div className="mt-1 border-t border-[hsl(var(--border-subtle))] px-1.5 pt-1.5">
                  <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--text-tertiary))]">Incidents</div>
                  {incidents.map((i) => (
                    <button
                      key={i.id}
                      onClick={goToIncidents}
                      className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left hover:bg-[hsl(var(--surface-2))]"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 flex-none text-[hsl(var(--risk-high))]" />
                      <div className="min-w-0">
                        <div className="truncate text-[12px] text-[hsl(var(--text-primary))]">{i.title}</div>
                        <div className="truncate text-[10.5px] text-[hsl(var(--text-tertiary))]">
                          {i.severity} · {i.status.replace(/_/g, " ").toLowerCase()}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
