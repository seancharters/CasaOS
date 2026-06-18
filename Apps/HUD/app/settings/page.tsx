'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, CheckCircle, XCircle, Eye, EyeOff, Database, Loader2 } from 'lucide-react';
import type { HudConfig } from '@/lib/types';
import { defaultConfig } from '@/lib/types';

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  secret,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-hud-muted-light">{label}</label>
      <div className="relative">
        <input
          type={secret && !show ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-hud-bg border border-hud-border rounded-lg px-3 py-2 text-hud-text text-sm placeholder:text-hud-muted focus:outline-none focus:border-brand-purple transition-colors pr-10"
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-hud-muted hover:text-hud-text transition-colors"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-hud-muted">{hint}</p>}
    </div>
  );
}

function Section({ title, subtitle, action, children }: { title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-hud-card border border-hud-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-hud-border flex items-start justify-between gap-4">
        <div>
          <h2 className="text-hud-text font-semibold text-base">{title}</h2>
          <p className="text-hud-muted text-xs mt-1">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="p-6 grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

export default function SettingsPage() {
  const [config, setConfig] = useState<HudConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [pgTestStatus, setPgTestStatus] = useState<TestStatus>('idle');
  const [pgTestError, setPgTestError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then(setConfig).catch(() => {});
  }, []);

  const updateCW = (key: keyof HudConfig['connectwise'], value: string) => {
    setConfig((c) => ({ ...c, connectwise: { ...c.connectwise, [key]: value } }));
  };

  const update3CX = (key: keyof HudConfig['threecx'], value: string) => {
    setConfig((c) => ({ ...c, threecx: { ...c.threecx, [key]: value } }));
  };

  const updatePG = (key: keyof NonNullable<HudConfig['postgres']>, value: string | boolean) => {
    setConfig((c) => ({ ...c, postgres: { ...defaultConfig.postgres!, ...c.postgres, [key]: value } }));
    setPgTestStatus('idle');
    setPgTestError(null);
  };

  const testPostgres = async () => {
    setPgTestStatus('testing');
    setPgTestError(null);
    try {
      const res = await fetch('/api/settings/test-postgres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.postgres ?? defaultConfig.postgres),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setPgTestStatus('ok');
        setTimeout(() => setPgTestStatus('idle'), 4000);
      } else {
        setPgTestStatus('error');
        setPgTestError(data.error ?? 'Connection failed');
      }
    } catch (e) {
      setPgTestStatus('error');
      setPgTestError(String(e));
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setSaveStatus(res.ok ? 'success' : 'error');
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const pg = config.postgres ?? defaultConfig.postgres!;

  return (
    <div className="min-h-screen bg-hud-bg">
      <header className="flex items-center justify-between px-6 py-3 border-b border-hud-border bg-hud-card">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-hud-muted hover:text-hud-text transition-colors text-sm"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </Link>
          <div className="w-px h-4 bg-hud-border" />
          <div>
            <span className="text-hud-text font-semibold">Settings</span>
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-purple hover:bg-brand-light-purple disabled:opacity-50 text-hud-text text-sm font-medium transition-colors"
        >
          {saving ? (
            <span>Saving…</span>
          ) : saveStatus === 'success' ? (
            <>
              <CheckCircle size={14} />
              Saved
            </>
          ) : saveStatus === 'error' ? (
            <>
              <XCircle size={14} />
              Error
            </>
          ) : (
            <>
              <Save size={14} />
              Save Settings
            </>
          )}
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-hud-text">API Configuration</h1>
          <p className="text-hud-muted text-sm mt-1">
            Credentials are stored in <code className="text-brand-purple">~/.config/hud/config.json</code> on the server and never committed to source control.
          </p>
        </div>

        <Section
          title="ConnectWise PSA"
          subtitle="Required for ticket metrics, resource workload, and P1/P2 ticket table."
        >
          <FieldInput
            label="Site URL"
            value={config.connectwise.siteUrl}
            onChange={(v) => updateCW('siteUrl', v)}
            placeholder="na.myconnectwise.net"
            hint="Without https:// — e.g. na.myconnectwise.net or yourcompany.connectwise.net"
          />
          <FieldInput
            label="Company ID"
            value={config.connectwise.companyId}
            onChange={(v) => updateCW('companyId', v)}
            placeholder="YourCompanyId"
          />
          <FieldInput
            label="Public Key"
            value={config.connectwise.publicKey}
            onChange={(v) => updateCW('publicKey', v)}
            placeholder="Public API key"
            secret
          />
          <FieldInput
            label="Private Key"
            value={config.connectwise.privateKey}
            onChange={(v) => updateCW('privateKey', v)}
            placeholder="Private API key"
            secret
          />
          <div className="col-span-2">
            <FieldInput
              label="Client ID"
              value={config.connectwise.clientId}
              onChange={(v) => updateCW('clientId', v)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              hint="Register your Client ID at developer.connectwise.com"
            />
          </div>
        </Section>

        <Section
          title="3CX Phone System"
          subtitle="Required for call statistics, agent login status, and active call monitoring."
        >
          <FieldInput
            label="Host"
            value={config.threecx.host}
            onChange={(v) => update3CX('host', v)}
            placeholder="yourcompany.3cx.com.au"
            hint="Hostname or IP — add https:// to force HTTPS, http:// to force HTTP"
          />
          <FieldInput
            label="Client ID"
            value={config.threecx.clientId}
            onChange={(v) => update3CX('clientId', v)}
            placeholder="your-client-id"
            hint="From 3CX Admin → Settings → API → Client Credentials"
          />
          <FieldInput
            label="Client Secret"
            value={config.threecx.clientSecret}
            onChange={(v) => update3CX('clientSecret', v)}
            placeholder="••••••••"
            secret
          />
        </Section>

        <Section
          title="3CX Call History Database"
          subtitle="Optional PostgreSQL connection for call log statistics. Used when the 3CX CallHistoryView API is unavailable (v20+)."
          action={
            <button
              type="button"
              onClick={testPostgres}
              disabled={pgTestStatus === 'testing' || !pg.host || !pg.database || !pg.username}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-hud-border text-hud-muted hover:text-hud-text hover:border-hud-muted disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-colors shrink-0"
            >
              {pgTestStatus === 'testing' ? (
                <><Loader2 size={12} className="animate-spin" /> Testing…</>
              ) : pgTestStatus === 'ok' ? (
                <><CheckCircle size={12} className="text-green-400" /> Connected</>
              ) : pgTestStatus === 'error' ? (
                <><XCircle size={12} className="text-red-400" /> Failed</>
              ) : (
                <><Database size={12} /> Test Connection</>
              )}
            </button>
          }
        >
          <FieldInput
            label="Host"
            value={pg.host}
            onChange={(v) => updatePG('host', v)}
            placeholder="localhost or 192.168.1.100"
          />
          <FieldInput
            label="Port"
            value={pg.port}
            onChange={(v) => updatePG('port', v)}
            placeholder="5432"
          />
          <FieldInput
            label="Database"
            value={pg.database}
            onChange={(v) => updatePG('database', v)}
            placeholder="3cxphonedb"
          />
          <FieldInput
            label="Username"
            value={pg.username}
            onChange={(v) => updatePG('username', v)}
            placeholder="postgres"
          />
          <FieldInput
            label="Password"
            value={pg.password}
            onChange={(v) => updatePG('password', v)}
            placeholder="••••••••"
            secret
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                role="checkbox"
                aria-checked={pg.ssl}
                tabIndex={0}
                onClick={() => updatePG('ssl', !pg.ssl)}
                onKeyDown={(e) => e.key === ' ' && updatePG('ssl', !pg.ssl)}
                className={`w-9 h-5 rounded-full transition-colors ${pg.ssl ? 'bg-brand-purple' : 'bg-hud-border'} relative cursor-pointer`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${pg.ssl ? 'translate-x-4' : ''}`} />
              </div>
              <span className="text-sm text-hud-muted-light">Enable SSL</span>
            </label>
          </div>
          {pgTestStatus === 'error' && pgTestError && (
            <div className="col-span-2 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <XCircle size={14} className="shrink-0 mt-0.5" />
              <span className="font-mono break-all">{pgTestError}</span>
            </div>
          )}
        </Section>

        <div className="bg-hud-card border border-hud-border/50 rounded-xl p-5 text-sm text-hud-muted space-y-1.5">
          <p className="text-hud-text font-medium text-xs uppercase tracking-wider mb-2">Notes</p>
          <p>• The dashboard works in <span className="text-brand-orange">Demo Mode</span> until credentials are configured.</p>
          <p>• Data refreshes every <span className="text-hud-text">30 seconds</span> via a live server connection.</p>
          <p>• For ConnectWise, create a dedicated API Member with <span className="text-hud-text">Service → Tickets → Inquire</span> permissions.</p>
          <p>• For 3CX, use an admin account or a dedicated reporting user.</p>
          <p>• PostgreSQL call stats are used automatically when the 3CX call log API returns no data.</p>
        </div>
      </main>
    </div>
  );
}
