'use client';

import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { defaultDateRange, getPresetRange, formatRangeLabel } from '@/lib/dateRange';
import type { DateRange, DatePreset } from '@/lib/dateRange';

const PRESETS: { label: string; value: Exclude<DatePreset, 'custom'> }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this_week' },
  { label: 'Last 7 Days', value: 'last_7_days' },
  { label: 'This Month', value: 'this_month' },
];

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export default function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);

  const selectPreset = (preset: Exclude<DatePreset, 'custom'>) => {
    const range = getPresetRange(preset);
    onChange({ preset, ...range });
    setOpen(false);
  };

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    const from = customFrom <= customTo ? customFrom : customTo;
    const to = customFrom <= customTo ? customTo : customFrom;
    onChange({ preset: 'custom', from, to });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded border border-hud-border bg-hud-card text-xs text-hud-text hover:border-brand-purple/60 transition-colors"
      >
        <Calendar size={13} className="text-brand-purple" />
        <span>{formatRangeLabel(value)}</span>
        <ChevronDown size={12} className={`text-hud-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-hud-card border border-hud-border rounded-lg shadow-xl overflow-hidden">
            {/* Presets */}
            <div className="p-1">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => selectPreset(p.value)}
                  className={`w-full text-left px-3 py-2 text-xs rounded transition-colors ${
                    value.preset === p.value
                      ? 'bg-brand-purple/20 text-brand-purple'
                      : 'text-hud-muted hover:text-hud-text hover:bg-hud-border'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom range */}
            <div className="border-t border-hud-border p-3 space-y-2">
              <p className="text-xs text-hud-muted font-medium uppercase tracking-wider">Custom</p>
              <div className="space-y-1.5">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full bg-hud-bg border border-hud-border rounded px-2 py-1 text-xs text-hud-text focus:outline-none focus:border-brand-purple"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full bg-hud-bg border border-hud-border rounded px-2 py-1 text-xs text-hud-text focus:outline-none focus:border-brand-purple"
                />
              </div>
              <button
                onClick={applyCustom}
                disabled={!customFrom || !customTo}
                className="w-full py-1.5 bg-brand-purple text-white text-xs rounded font-medium disabled:opacity-40 hover:bg-brand-purple/80 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
