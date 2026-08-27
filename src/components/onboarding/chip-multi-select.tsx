"use client";

import * as React from "react";
import { Chip } from "@/components/ui/chip";

export interface ChipOption {
  slug: string;
  label: string;
  category?: string;
}

/**
 * Multi-select chip grid that submits each selected value as a repeated
 * hidden field (`name`), so it works with plain FormData / Server Actions.
 */
export function ChipMultiSelect({
  name,
  options,
  initial = [],
  min,
  max,
  groupByCategory = false,
  onCountChange,
}: {
  name: string;
  options: ChipOption[];
  initial?: string[];
  min?: number;
  max?: number;
  groupByCategory?: boolean;
  onCountChange?: (count: number) => void;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(initial),
  );

  const toggle = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else if (!max || next.size < max) next.add(slug);
      onCountChange?.(next.size);
      return next;
    });
  };

  const groups = React.useMemo(() => {
    if (!groupByCategory) return [["", options]] as const;
    const m = new Map<string, ChipOption[]>();
    for (const o of options) {
      const k = o.category ?? "";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(o);
    }
    return [...m.entries()];
  }, [options, groupByCategory]);

  return (
    <div className="flex flex-col gap-4">
      {[...selected].map((s) => (
        <input key={s} type="hidden" name={name} value={s} />
      ))}
      {groups.map(([cat, opts]) => (
        <div key={cat || "all"} className="flex flex-col gap-2">
          {cat && (
            <span className="text-xs font-medium uppercase tracking-wider text-ink-faint">
              {cat}
            </span>
          )}
          <div className="flex flex-wrap gap-2">
            {opts.map((o) => (
              <Chip
                key={o.slug}
                selected={selected.has(o.slug)}
                onSelectedChange={() => toggle(o.slug)}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
      ))}
      {(min || max) && (
        <p className="text-xs text-ink-faint">
          {selected.size} selected
          {min ? ` · pick at least ${min}` : ""}
          {max ? ` · up to ${max}` : ""}
        </p>
      )}
    </div>
  );
}
