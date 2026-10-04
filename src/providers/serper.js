import { requireEnv } from '../config.js';

// Serper.dev: Google results. https://serper.dev
const TBS = { hour: 'qdr:h', day: 'qdr:d', week: 'qdr:w', month: 'qdr:m' };

export async function search({ query, country, lookback, num }) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': requireEnv('SERPER_API_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      gl: country,
      num,
      tbs: TBS[lookback] || TBS.week,
    }),
  });
  if (!res.ok) {
    throw new Error(`Serper ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.organic || []).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
    date: r.date || null,
    raw: r,
  }));
}
