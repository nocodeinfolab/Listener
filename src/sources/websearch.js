import { config } from '../config.js';
import { getProvider } from '../providers/index.js';

// A "channel" is a way of searching. Facebook and X are reached through
// site: searches, so only public, search-engine-indexed posts are visible.
const CHANNEL_PREFIX = {
  web: '',
  facebook: 'site:facebook.com ',
  x: 'site:x.com ',
};

export function baseQuery(kw) {
  if (kw.query && kw.query.trim()) return kw.query.trim();
  const term = kw.term.trim();
  // Quote multi-word terms so "Cancer Care" matches the phrase, not two stray words.
  return /\s/.test(term) ? `"${term}"` : term;
}

export function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    u.hash = '';
    if (/(^|\.)facebook\.com$/i.test(u.hostname)) {
      u.hostname = 'facebook.com'; // www., m., web. variants are the same page
    } else {
      u.hostname = u.hostname.replace(/^www\./i, '');
    }
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mibextid|ref$)/i.test(key)) u.searchParams.delete(key);
    }
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return raw;
  }
}

export function sourceFromUrl(url) {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'web';
  }
  if (/(^|\.)(facebook\.com|fb\.com|fb\.watch)$/.test(host)) return 'facebook';
  if (/(^|\.)(x\.com|twitter\.com)$/.test(host)) return 'x';
  return 'web';
}

export function parseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const rel = /^(\d+)\s+(minute|hour|day|week|month)s?\s+ago$/i.exec(text);
  if (rel) {
    const unit = { minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6 }[
      rel[2].toLowerCase()
    ];
    return new Date(Date.now() - Number(rel[1]) * unit);
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Run one keyword through one channel and return normalized items.
export async function searchChannel(kw, channel) {
  if (!(channel in CHANNEL_PREFIX)) {
    throw new Error(`Unknown channel "${channel}". Use web, facebook or x.`);
  }
  const results = await getProvider().search({
    query: CHANNEL_PREFIX[channel] + baseQuery(kw),
    country: config.search.country,
    lookback: config.search.lookback,
    num: config.search.resultsPerQuery,
  });

  return results
    .filter((r) => r.url)
    .map((r) => {
      const url = normalizeUrl(r.url);
      return {
        source: sourceFromUrl(url),
        externalId: url,
        keyword: kw.term,
        url,
        title: r.title || null,
        text: r.snippet || null,
        publishedAt: parseDate(r.date),
        raw: r.raw,
      };
    });
}
