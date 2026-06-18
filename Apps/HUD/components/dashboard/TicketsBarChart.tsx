'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { TicketResource } from '@/lib/types';
import { useTheme } from '@/lib/theme';

interface Props {
  data: TicketResource[];
}

const PURPLE = '#8421de';

export default function TicketsBarChart({ data }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const mutedColor   = isDark ? '#6b7280' : '#64748b';
  const labelColor   = isDark ? '#9ca3af' : '#475569';
  const tooltipBg    = isDark ? '#1a1a1a' : '#ffffff';
  const tooltipBorder = isDark ? '#2a2a2a' : '#e2e8f0';
  const tooltipText  = isDark ? '#ffffff' : '#0f172a';

  return (
    <div className="bg-hud-card border border-hud-border rounded-lg overflow-hidden flex-1">
      <div className="px-4 py-2.5 border-b border-hud-border">
        <h2 className="text-hud-text text-sm font-semibold">Open Tickets Per Resource</h2>
      </div>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-hud-muted text-sm">
          No data
        </div>
      ) : (
        <div className="px-2 pt-3 pb-2">
          <ResponsiveContainer width="100%" height={Math.max(120, data.length * 32)}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
            >
              <XAxis
                type="number"
                tick={{ fill: mutedColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={72}
                tick={{ fill: labelColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: 6,
                  color: tooltipText,
                  fontSize: 12,
                }}
                cursor={{ fill: 'rgba(132,33,222,0.1)' }}
              />
              <Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={18}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PURPLE} />
                ))}
                <LabelList
                  dataKey="count"
                  position="right"
                  style={{ fill: labelColor, fontSize: 11 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
