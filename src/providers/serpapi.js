import { requireEnv } from '../config.js';

// SerpApi: Google results. https://serpapi.com
const TBS = { hour: 'qdr:h', day: 'qdr:d', week: 'qdr:w', month: 'qdr:m' };

export async function search({ query, country, lookback, num }) {
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    gl: country,
    num: String(num),
    tbs: TBS[lookback] || TBS.week,
    api_key: requireEnv('SERPAPI_API_KEY'),
  });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) {
    throw new Error(`SerpApi ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.error && !data.organic_results) {
    // SerpApi answers 200 with an error message when a search finds nothing.
    if (/hasn't returned any results/i.test(data.error)) return [];
    throw new Error(`SerpApi: ${data.error}`);
  }
  return (data.organic_results || []).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
    date: r.date || null,
    raw: r,
  }));
}
