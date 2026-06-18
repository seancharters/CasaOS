'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Settings, Wifi, WifiOff, RefreshCw, SlidersHorizontal, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import type { DateRange } from '@/lib/dateRange';

const NAV_LINKS = [
  { href: '/',      label: 'Support' },
  { href: '/sales', label: 'Sales'   },
];

interface HeaderProps {
  lastUpdated: string | null;
  isDemo: boolean;
  hasErrors: boolean;
  isConnected: boolean;
  editMode: boolean;
  onToggleEditMode: () => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export default function Header({
  lastUpdated,
  isDemo,
  hasErrors,
  isConnected,
  editMode,
  onToggleEditMode,
  dateRange,
  onDateRangeChange,
}: HeaderProps) {
  const pathname = usePathname();
  const { theme, toggle: toggleTheme } = useTheme();

  const time = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--';

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-hud-border bg-hud-card">
      <div className="flex items-center">
        <Image
          src={theme === 'light' ? '/cc-black.png' : '/cc-white.png'}
          alt="Cloud Context"
          width={140}
          height={40}
          className="h-10 w-auto object-contain"
          priority
        />
      </div>

      {/* Dashboard nav */}
      <nav className="flex items-center gap-1 bg-hud-bg rounded-lg p-1 border border-hud-border">
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                active
                  ? 'bg-brand-purple text-white'
                  : 'text-hud-muted hover:text-hud-text hover:bg-hud-border'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-4">
        {isDemo && (
          <span className="text-xs px-2 py-1 rounded bg-brand-orange/20 text-brand-orange border border-brand-orange/30 font-medium">
            DEMO MODE
          </span>
        )}
        {hasErrors && !isDemo && (
          <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
            DATA ERROR
          </span>
        )}

        <DateRangePicker value={dateRange} onChange={onDateRangeChange} />

        <div className="flex items-center gap-2 text-xs text-hud-muted">
          <RefreshCw size={12} />
          <span>Updated {time}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {isConnected ? (
            <>
              <Wifi size={14} className="text-green-500" />
              <span className="text-green-500">Live</span>
            </>
          ) : (
            <>
              <WifiOff size={14} className="text-red-400" />
              <span className="text-red-400">Disconnected</span>
            </>
          )}
        </div>

        <button
          onClick={onToggleEditMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            editMode
              ? 'bg-brand-purple text-white'
              : 'text-hud-muted hover:text-hud-text hover:bg-hud-border'
          }`}
        >
          <SlidersHorizontal size={13} />
          <span>Configure</span>
        </button>

        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-hud-muted hover:text-hud-text hover:bg-hud-border transition-colors"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        <Link
          href="/settings"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-hud-muted hover:text-hud-text hover:bg-hud-border transition-colors"
        >
          <Settings size={13} />
          <span>Settings</span>
        </Link>
      </div>
    </header>
  );
}
