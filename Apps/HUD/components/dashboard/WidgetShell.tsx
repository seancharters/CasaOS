import { Settings } from 'lucide-react';
import type { WidgetConfigs } from '@/lib/types';

interface WidgetShellProps {
  title: string;
  widgetKey: keyof WidgetConfigs;
  editMode: boolean;
  onEdit: (key: keyof WidgetConfigs) => void;
  children: React.ReactNode;
  className?: string;
}

export default function WidgetShell({
  title,
  widgetKey,
  editMode,
  onEdit,
  children,
  className = '',
}: WidgetShellProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      {editMode && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-1 bg-brand-purple/10 border border-brand-purple/30 rounded-t-lg -mb-px">
          <span className="text-brand-purple text-xs font-semibold uppercase tracking-wider">
            {title}
          </span>
          <button
            onClick={() => onEdit(widgetKey)}
            className="flex items-center gap-1 text-xs text-brand-purple hover:text-hud-text transition-colors px-2 py-0.5 rounded hover:bg-brand-purple/20"
            aria-label={`Configure ${title}`}
          >
            <Settings size={12} />
            <span>Configure</span>
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
