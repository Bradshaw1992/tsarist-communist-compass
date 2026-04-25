// =============================================================================
// SchoolPicker — typeahead picker over the public.schools table
// =============================================================================
// Controlled component. Shows a search input; as the user types we query
// public.schools (ILIKE on name, status='Open') and render the top 8 hits
// with their address so the user can disambiguate two schools with the
// same name.
//
// Storage is the parent's job — this component is purely a picker. On
// selection it calls onChange(urn, school) with both the URN and the
// fetched row, so the parent can render a "selected" state without
// re-querying.
//
// "Not listed" fallback: if onNotListed is passed, a link appears under
// the results that calls it. Parent decides what that does (we'll wire
// it to a school_requests insert later).
//
// Anonymous mode: this component does not check auth — that's the parent's
// concern. The schools table has public RLS read access, so the picker
// will work even if no user is signed in.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, MapPin, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface SchoolInfo {
  urn: number;
  name: string;
  street: string | null;
  locality: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
}

interface SchoolPickerProps {
  /** Currently selected URN, or null if none. */
  value: number | null;
  /** Called when the user selects a school from the dropdown. */
  onChange: (urn: number, school: SchoolInfo) => void;
  /** Optional: render a "school not listed?" link that calls this. */
  onNotListed?: () => void;
  /** Optional: placeholder text for the search input. */
  placeholder?: string;
  /** Optional: auto-focus the input on mount. */
  autoFocus?: boolean;
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;
const MAX_RESULTS = 8;

function formatAddress(s: SchoolInfo): string {
  return [s.street, s.locality, s.town, s.county, s.postcode]
    .filter(Boolean)
    .join(", ");
}

/**
 * Normalise the user's search input so common spelling differences match.
 * GIAS stores "St Peter's" not "St. Peter's"; users often add the period.
 * Curly vs straight apostrophes also differ between OS keyboards.
 */
function normaliseQuery(q: string): string {
  return q
    .replace(/[.‘’‚‛]/g, (c) => (c === "." ? "" : "'"))
    .replace(/\s+/g, " ")
    .trim();
}

export function SchoolPicker({
  value,
  onChange,
  onNotListed,
  placeholder = "Start typing your school name…",
  autoFocus = false,
}: SchoolPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchoolInfo[]>([]);
  const [selected, setSelected] = useState<SchoolInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the latest in-flight request so out-of-order responses are ignored.
  const requestIdRef = useRef(0);

  // Hydrate the selected display when `value` is set externally (e.g. on mount
  // for a user who already has a school).
  useEffect(() => {
    if (value === null) {
      setSelected(null);
      return;
    }
    if (selected?.urn === value) return; // already in sync

    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("schools" as never)
        .select("urn, name, street, locality, town, county, postcode")
        .eq("urn", value)
        .maybeSingle();
      if (cancelled) return;
      if (err || !data) return;
      setSelected(data as unknown as SchoolInfo);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Debounced search.
  useEffect(() => {
    const trimmed = normaliseQuery(query);
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const reqId = ++requestIdRef.current;

    const handle = window.setTimeout(async () => {
      const { data, error: err } = await supabase
        .from("schools" as never)
        .select("urn, name, street, locality, town, county, postcode")
        .ilike("name", `%${trimmed}%`)
        .eq("status", "Open")
        .order("name")
        .limit(MAX_RESULTS);

      // Ignore if a newer request has started.
      if (reqId !== requestIdRef.current) return;

      if (err) {
        setError("Couldn't search schools — please try again.");
        setResults([]);
      } else {
        setError(null);
        setResults((data ?? []) as unknown as SchoolInfo[]);
      }
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [query]);

  const showResults = query.trim().length >= MIN_QUERY_LENGTH;

  const selectedAddress = useMemo(
    () => (selected ? formatAddress(selected) : ""),
    [selected]
  );

  function handleSelect(school: SchoolInfo) {
    setSelected(school);
    setQuery("");
    setResults([]);
    onChange(school.urn, school);
  }

  function handleClear() {
    setSelected(null);
    setQuery("");
    setResults([]);
  }

  // If a school is already selected and the user isn't actively searching,
  // show the selected state instead of the search box.
  if (selected && query === "") {
    return (
      <div className="rounded-md border border-border bg-card p-3 text-sm">
        <div className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          <div className="flex-1">
            <div className="font-medium">{selected.name}</div>
            {selectedAddress && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {selectedAddress}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleClear}
          >
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="pl-9"
          aria-label="Search for your school"
          autoComplete="off"
        />
      </div>

      {showResults && (
        <div className="rounded-md border border-border bg-popover">
          {loading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Searching…
            </div>
          )}
          {!loading && error && (
            <div className="px-3 py-2 text-sm text-destructive">{error}</div>
          )}
          {!loading && !error && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No schools found.
              {onNotListed && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={onNotListed}
                    className="underline hover:text-foreground"
                  >
                    Add yours manually
                  </button>
                  .
                </>
              )}
            </div>
          )}
          {!loading && !error && results.length > 0 && (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((school) => {
                const address = formatAddress(school);
                return (
                  <li key={school.urn}>
                    <button
                      type="button"
                      onClick={() => handleSelect(school)}
                      className="block w-full px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                    >
                      <div className="text-sm font-medium">{school.name}</div>
                      {address && (
                        <div className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>{address}</span>
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {!showResults && onNotListed && (
        <button
          type="button"
          onClick={onNotListed}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          School not listed?
        </button>
      )}
    </div>
  );
}
