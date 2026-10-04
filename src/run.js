import { config } from './config.js';
import { query } from './db.js';
import { searchChannel } from './sources/websearch.js';
import { isRelevant } from './filter/index.js';
import { sendTelegram, formatMention } from './notify/telegram.js';
import { sleep, esc, clip } from './util.js';

const HEALTH_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
let lastHealthAlert = 0;

const log = (...args) => console.log(new Date().toISOString(), ...args);

// Insert a result if we have not seen it before. Returns its status, or null if it was a duplicate.
async function saveItem(item) {
  const status = isRelevant(item) ? 'new' : 'filtered';
  const r = await query(
    `INSERT INTO mentions
       (source, external_id, keyword, url, title, text, published_at, raw, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (source, external_id) DO NOTHING
     RETURNING id`,
    [
      item.source,
      item.externalId,
      item.keyword,
      item.url,
      item.title,
      item.text,
      item.publishedAt,
      JSON.stringify(item.raw ?? null),
      status,
    ]
  );
  return r.rowCount ? status : null;
}

// Send waiting mentions to Telegram, newest first, up to the per-cycle cap.
async function deliverPending() {
  const { rows } = await query(
    `SELECT * FROM mentions
     WHERE status = 'new'
     ORDER BY COALESCE(published_at, found_at) DESC
     LIMIT $1`,
    [config.maxAlertsPerCycle]
  );

  for (const m of rows) {
    await sendTelegram(formatMention(m));
    await query(`UPDATE mentions SET status = 'sent', notified_at = now() WHERE id = $1`, [m.id]);
    await sleep(1100); // stay under Telegram's ~1 message/second per chat
  }

  const { rows: left } = await query(`SELECT count(*)::int AS n FROM mentions WHERE status = 'new'`);
  if (rows.length && left[0].n > 0) {
    await sendTelegram(`… ${left[0].n} more waiting, they will arrive in the next cycle.`);
  }
  return rows.length;
}

// Scrapers and APIs fail quietly. If the whole cycle found nothing or mostly errored, say so.
async function maybeHealthAlert({ queries, failed, fetched, errors }) {
  const mostlyFailed = failed > 0 && failed * 2 >= queries;
  const empty = queries > 0 && failed === 0 && fetched === 0;
  if (!mostlyFailed && !empty) return;
  if (Date.now() - lastHealthAlert < HEALTH_ALERT_COOLDOWN_MS) return;
  lastHealthAlert = Date.now();

  const detail = mostlyFailed
    ? `${failed} of ${queries} searches failed.\n${esc(clip(errors[0], 300))}`
    : `All ${queries} searches returned zero results.`;
  await sendTelegram(`⚠️ <b>Listener needs attention</b>\n${detail}`);
}

export async function runCycle() {
  const { rows: keywords } = await query(`SELECT * FROM keywords WHERE active ORDER BY id`);
  if (!keywords.length) {
    log('No active keywords. Add one with: npm run kw -- add "term"');
    return;
  }

  let queries = 0;
  let failed = 0;
  let fetched = 0;
  let added = 0;
  let filtered = 0;
  const errors = [];

  for (const kw of keywords) {
    for (const channel of config.search.channels) {
      queries++;
      try {
        const items = await searchChannel(kw, channel);
        fetched += items.length;
        for (const item of items) {
          const status = await saveItem(item);
          if (status === 'new') added++;
          else if (status === 'filtered') filtered++;
        }
      } catch (e) {
        failed++;
        errors.push(`${kw.term} / ${channel}: ${e.message}`);
        log('search failed:', kw.term, channel, e.message);
      }
      await sleep(300); // be gentle with the search API
    }
  }

  let sent = 0;
  try {
    sent = await deliverPending();
    await maybeHealthAlert({ queries, failed, fetched, errors });
  } catch (e) {
    log('delivery failed:', e.message);
  }

  log(
    `cycle done: ${queries} searches (${failed} failed), ${fetched} results, ` +
      `${added} new, ${filtered} filtered, ${sent} alerts sent`
  );
}
