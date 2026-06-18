import { Pool, PoolClient } from 'pg';
import type { HudConfig } from './types';
import type { CallStats } from './types';
import type { DateRange } from './dateRange';
import { dayStart, dayEnd } from './dateRange';

let pool: Pool | null = null;
let poolKey = '';

function getPool(cfg: NonNullable<HudConfig['postgres']>): Pool {
  const key = `${cfg.host}:${cfg.port}:${cfg.database}:${cfg.username}`;
  if (pool && poolKey === key) return pool;
  if (pool) { pool.end().catch(() => {}); }
  pool = new Pool({
    host: cfg.host,
    port: parseInt(cfg.port, 10) || 5432,
    database: cfg.database,
    user: cfg.username,
    password: cfg.password,
    ssl: cfg.ssl ? { rejectUnauthorized: false } : false,
    max: 3,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 5000,
  });
  poolKey = key;
  return pool;
}

export async function testConnection(cfg: NonNullable<HudConfig['postgres']>): Promise<{ ok: boolean; error?: string }> {
  const client = await getPool(cfg).connect().catch((e: Error) => ({ error: e.message }));
  if ('error' in client) return { ok: false, error: (client as { error: string }).error };
  const c = client as PoolClient;
  try {
    await c.query('SELECT 1');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    c.release();
  }
}

function fmt(seconds: number): string {
  if (!seconds || seconds < 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export async function fetchPostgresCallStats(
  cfg: NonNullable<HudConfig['postgres']>,
  dateRange: DateRange
): Promise<{ callStats: Partial<CallStats>; errors: string[] }> {
  const errors: string[] = [];

  try {
    const db = getPool(cfg);
    const from = dayStart(dateRange.from);
    const to   = dayEnd(dateRange.to);

    // Each physical call generates 3-4 CDR rows (trunk leg + routing legs + answered leg).
    // We deduplicate on main_call_history_id and aggregate per call:
    //   - was_answered: any row has cdr_answered_at set (matches the user's Grafana pattern)
    //   - talk_secs:    MAX(cdr_ended_at - cdr_answered_at) = the longest answered leg = actual conversation
    //   - total_secs:   MAX(cdr_ended_at) - MIN(cdr_started_at) = first ring to final end
    //   - is_overflow / is_afterhours: sourced from source_presentation tags on queue-facing rows
    const result = await db.query<{
      total_calls:     number;
      answered_calls:  number;
      missed_calls:    number;
      overflow_calls:  number;
      afterhours_calls: number;
      avg_talk_secs:   number | null;
      avg_total_secs:  number | null;
    }>(
      `WITH call_summary AS (
        SELECT
          main_call_history_id,
          MAX(CASE WHEN cdr_answered_at IS NOT NULL THEN 1 ELSE 0 END)             AS was_answered,
          MAX(CASE WHEN source_presentation LIKE '%overflow%'   THEN 1 ELSE 0 END) AS is_overflow,
          MAX(CASE WHEN source_presentation LIKE '%Afterhours%' THEN 1 ELSE 0 END) AS is_afterhours,
          COALESCE(
            MAX(EXTRACT(EPOCH FROM (cdr_ended_at - cdr_answered_at))::int), 0
          )                                                                         AS talk_secs,
          EXTRACT(EPOCH FROM (MAX(cdr_ended_at) - MIN(cdr_started_at)))::int       AS total_secs
        FROM public.cdroutput
        WHERE cdr_started_at >= $1
          AND cdr_started_at <= $2
          AND source_entity_type = 'external_line'
        GROUP BY main_call_history_id
      )
      SELECT
        COUNT(*)::int                                                          AS total_calls,
        SUM(was_answered)::int                                                 AS answered_calls,
        SUM(1 - was_answered)::int                                             AS missed_calls,
        SUM(is_overflow)::int                                                  AS overflow_calls,
        SUM(is_afterhours)::int                                                AS afterhours_calls,
        ROUND(AVG(CASE WHEN was_answered = 1 AND talk_secs > 0
                       THEN talk_secs END))::int                               AS avg_talk_secs,
        ROUND(AVG(total_secs))::int                                            AS avg_total_secs
      FROM call_summary`,
      [from, to]
    );

    const row = result.rows[0];
    const total      = row.total_calls      ?? 0;
    const answered   = row.answered_calls   ?? 0;
    const missed     = row.missed_calls     ?? 0;
    const overflow   = row.overflow_calls   ?? 0;
    const afterhours = row.afterhours_calls ?? 0;
    const pct        = total > 0 ? Math.round((answered / total) * 100) : 0;

    return {
      callStats: {
        pctAnswered:      pct,
        answeredOverflow: overflow,
        missedCalls:      missed,
        totalCalls:       total,
        afterHoursCalls:  afterhours,
        avgTalkDuration:  row.avg_talk_secs  != null ? fmt(row.avg_talk_secs)  : null,
        avgCallDuration:  row.avg_total_secs != null ? fmt(row.avg_total_secs) : null,
      },
      errors,
    };
  } catch (e) {
    errors.push(`PostgreSQL call stats: ${e instanceof Error ? e.message : String(e)}`);
    return { callStats: {}, errors };
  }
}
