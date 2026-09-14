"use client";

import { searchSwedenPlacesAction } from "@/lib/opportunities/actions";
import type { SwedenPlaceResult } from "@/lib/places/sweden";
import { useRef, useState } from "react";

export function SwedenPlaceSearch({
  onSelect,
}: {
  onSelect: (place: SwedenPlaceResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SwedenPlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const debounceRef = useRef<number | null>(null);

  function onQueryChange(value: string) {
    setQuery(value);
    const trimmed = value.trim();
    const id = ++requestId.current;
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(() => {
      searchSwedenPlacesAction(trimmed)
        .then((items) => {
          if (id !== requestId.current) return;
          setResults(items);
          setOpen(true);
        })
        .finally(() => {
          if (id !== requestId.current) return;
          setLoading(false);
        });
    }, 280);
  }

  return (
    <div className="relative">
      <label className="block text-sm">
        <span className="text-muted">Search city, municipality or place</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => {
            if (results.length) setOpen(true);
          }}
          placeholder="Örebro, Malmö, Västerås, Hallsberg, Göteborg"
          className="mt-1 h-9 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          autoComplete="off"
        />
      </label>
      <p className="mt-1 text-xs text-muted">
        Sweden only. Selecting a place moves the map. It does not run screening.
      </p>
      {loading ? <p className="mt-1 text-xs text-muted">Searching…</p> : null}
      {open && results.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-line bg-surface shadow-sm">
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-canvas"
                onClick={() => {
                  onSelect(place);
                  setQuery(place.label);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{place.label}</span>
                <span className="ml-2 text-xs text-muted">{place.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
