import { requireEnv } from '../config.js';

// Brave Search API: Brave's own index. https://api.search.brave.com
const FRESHNESS = { hour: 'pd', day: 'pd', week: 'pw', month: 'pm' };

async function call(params) {
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': requireEnv('BRAVE_API_KEY'),
    },
  });
  return res;
}

export async function search({ query, country, lookback, num }) {
  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(num, 20)),
    freshness: FRESHNESS[lookback] || FRESHNESS.week,
  });
  params.set('country', country.toUpperCase());

  let res = await call(params);
  if (res.status === 422) {
    // Brave only accepts some country codes. Retry without the country bias.
    params.delete('country');
    res = await call(params);
  }
  if (!res.ok) {
    throw new Error(`Brave ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return ((data.web && data.web.results) || []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
    date: r.page_age || r.age || null,
    raw: r,
  }));
}
