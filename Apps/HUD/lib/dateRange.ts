export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'last_7_days' | 'this_month' | 'custom';

export interface DateRange {
  preset: DatePreset;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  last_7_days: 'Last 7 Days',
  this_month: 'This Month',
  custom: 'Custom',
};

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getPresetRange(preset: Exclude<DatePreset, 'custom'>): { from: string; to: string } {
  const now = new Date();
  const today = toDateStr(now);

  switch (preset) {
    case 'today':
      return { from: today, to: today };

    case 'yesterday': {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const s = toDateStr(d);
      return { from: s, to: s };
    }

    case 'this_week': {
      const d = new Date(now);
      const dow = d.getDay(); // 0=Sun
      d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // back to Monday
      return { from: toDateStr(d), to: today };
    }

    case 'last_7_days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: toDateStr(d), to: today };
    }

    case 'this_month': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toDateStr(d), to: today };
    }
  }
}

export function defaultDateRange(): DateRange {
  return { preset: 'today', ...getPresetRange('today') };
}

/** Start-of-day datetime for CW API conditions (no Z — CW interprets in tenant timezone) */
export function dayStart(dateStr: string): string {
  return `${dateStr}T00:00:00`;
}

/** End-of-day datetime for CW API conditions (no Z — CW interprets in tenant timezone) */
export function dayEnd(dateStr: string): string {
  return `${dateStr}T23:59:59`;
}

export function formatRangeLabel(range: DateRange): string {
  if (range.preset !== 'custom') return PRESET_LABELS[range.preset];
  if (range.from === range.to) return range.from;
  return `${range.from} – ${range.to}`;
}
