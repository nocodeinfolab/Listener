import 'dotenv/config';

const int = (value, fallback) => {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const list = (value, fallback = '') =>
  (value ?? fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  databaseUrl:
    process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/listener',

  search: {
    provider: (process.env.SEARCH_PROVIDER || 'serper').toLowerCase(),
    country: (process.env.SEARCH_COUNTRY || 'ng').toLowerCase(),
    lookback: (process.env.LOOKBACK || 'week').toLowerCase(),
    channels: list(process.env.CHANNELS, 'web,facebook').map((s) => s.toLowerCase()),
    resultsPerQuery: int(process.env.RESULTS_PER_QUERY, 10),
  },

  pollIntervalMinutes: int(process.env.POLL_INTERVAL_MINUTES, 180),
  maxAlertsPerCycle: int(process.env.MAX_ALERTS_PER_CYCLE, 10),
  excludeTerms: list(process.env.EXCLUDE_TERMS).map((s) => s.toLowerCase()),
};

// Read a required secret only when it is actually needed, so commands that
// don't need it (like `kw list`) work without it.
export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Add it to your .env file (see .env.example).`);
  }
  return value;
}
