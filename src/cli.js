import { readFile } from 'node:fs/promises';
import { query, close } from './db.js';
import { config } from './config.js';
import { sendTelegram } from './notify/telegram.js';
import { searchChannel } from './sources/websearch.js';

const STARTER_KEYWORDS = [
  'Oncology',
  'Cancer Care',
  'Cancer',
  'Radiotherapy',
  'Chemo',
  'Chemotherapy',
];

const [cmd, ...args] = process.argv.slice(2);

function usage() {
  console.log(`Usage:
  npm run db:init                          create tables and add the starter keywords
  npm run kw -- list                       show keywords
  npm run kw -- add "term"                 add a keyword
  npm run kw -- add "term" --query '"a" "b"'   add a keyword with a custom search query
  npm run kw -- off "term" | on "term"     pause / resume a keyword
  npm run kw -- remove "term"              delete a keyword
  npm run test:telegram                    send a test message
  npm run test:search -- "term" [web|facebook|x]   try a search (nothing is saved)
  npm run stats                            counts of stored mentions
  npm run skip-pending                     mark everything waiting as seen, without sending`);
}

async function dbInit() {
  const sql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await query(sql);
  const { rows } = await query('SELECT count(*)::int AS n FROM keywords');
  if (rows[0].n === 0) {
    for (const term of STARTER_KEYWORDS) {
      await query('INSERT INTO keywords (term) VALUES ($1) ON CONFLICT DO NOTHING', [term]);
    }
    console.log(`Added ${STARTER_KEYWORDS.length} starter keywords.`);
  }
  console.log('Database ready.');
}

async function keywords([sub, term, ...rest]) {
  switch (sub) {
    case 'list': {
      const { rows } = await query('SELECT term, query, active FROM keywords ORDER BY id');
      if (!rows.length) return console.log('No keywords yet. Add one: npm run kw -- add "term"');
      for (const r of rows) {
        console.log(`${r.active ? '[on] ' : '[off]'} ${r.term}${r.query ? `   (query: ${r.query})` : ''}`);
      }
      return;
    }
    case 'add': {
      if (!term) return usage();
      const i = rest.indexOf('--query');
      const custom = i >= 0 ? rest[i + 1] : null;
      const r = await query(
        'INSERT INTO keywords (term, query) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [term, custom]
      );
      return console.log(r.rowCount ? `Added "${term}".` : `"${term}" already exists.`);
    }
    case 'on':
    case 'off': {
      if (!term) return usage();
      const r = await query('UPDATE keywords SET active = $2 WHERE lower(term) = lower($1)', [
        term,
        sub === 'on',
      ]);
      return console.log(r.rowCount ? `"${term}" is now ${sub}.` : `No keyword "${term}".`);
    }
    case 'remove': {
      if (!term) return usage();
      const r = await query('DELETE FROM keywords WHERE lower(term) = lower($1)', [term]);
      return console.log(r.rowCount ? `Removed "${term}".` : `No keyword "${term}".`);
    }
    default:
      return usage();
  }
}

async function searchTest([term, channel = 'web']) {
  if (!term) return usage();
  const items = await searchChannel({ term, query: null }, channel);
  console.log(`${items.length} results for "${term}" on ${channel} (provider: ${config.search.provider}):`);
  items.forEach((it, i) => {
    console.log(`\n${i + 1}. [${it.source}] ${it.title}`);
    console.log(`   ${it.url}`);
    if (it.text) console.log(`   ${it.text.slice(0, 160)}`);
    if (it.publishedAt) console.log(`   ${it.publishedAt.toISOString()}`);
  });
}

try {
  switch (cmd) {
    case 'db-init':
      await dbInit();
      break;
    case 'kw':
      await keywords(args);
      break;
    case 'telegram-test':
      await sendTelegram('✅ Listener test: alerts are working.');
      console.log('Sent. Check Telegram.');
      break;
    case 'search-test':
      await searchTest(args);
      break;
    case 'stats': {
      const { rows } = await query(
        'SELECT source, status, count(*)::int AS n FROM mentions GROUP BY 1, 2 ORDER BY 1, 2'
      );
      if (rows.length) console.table(rows);
      else console.log('No mentions stored yet.');
      break;
    }
    case 'skip-pending': {
      const r = await query(
        `UPDATE mentions SET status = 'skipped', notified_at = now() WHERE status = 'new'`
      );
      console.log(`Marked ${r.rowCount} waiting mentions as seen.`);
      break;
    }
    default:
      usage();
  }
} catch (e) {
  console.error(e.message || e.code || e);
  process.exitCode = 1;
} finally {
  await close();
}
