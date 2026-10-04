# Listener

Searches the web (including public Facebook and X posts, via `site:` searches) for your keywords on a schedule, stores what it finds in Postgres, and sends new results to you on Telegram. You then open the link and join the conversation yourself.

## Setup

You need Node 18+ and a Postgres database.

1. Create a database, e.g. `createdb listener`.
2. `npm install`
3. `cp .env.example .env`, then fill in `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and the key for your search provider (`SEARCH_PROVIDER` is `serper`, `serpapi` or `brave`).
4. `npm run db:init` creates the tables and adds the starter keywords.
5. `npm run test:telegram` should send a message to your phone.
6. `npm run test:search -- "Cancer Care" facebook` should print real results. Nothing is saved.
7. `npm run once` runs one full cycle and sends up to 10 alerts.
8. `npm start` runs it continuously.

To keep it running after you close the terminal, use `pm2 start src/index.js --name listener` (after `npm i -g pm2`), or a systemd service.

## Changing keywords

Keywords live in the database, so you can change them any time without touching code. Changes apply from the next cycle.

```
npm run kw -- list
npm run kw -- add "radiation therapy"
npm run kw -- add "cancer" --query '"cancer" "Port Harcourt"'
npm run kw -- off "Cancer"
npm run kw -- remove "Chemo"
```

Single broad words ("Cancer", "Chemo") return lots of news and organisation pages. A custom `--query` with a place or a phrase usually gives much better results.

## How it works

- Each active keyword is searched once per channel in `CHANNELS` (`web`, `facebook`, `x`).
- Results are deduplicated by URL, so you are alerted once per page, even if several keywords or channels find it.
- Up to `MAX_ALERTS_PER_CYCLE` alerts are sent per cycle, newest first. The rest wait for the next cycle. After a first run, `npm run skip-pending` marks the backlog as seen if you only want alerts for new things.
- If a whole cycle returns nothing, or most searches fail, you get a warning on Telegram (at most once every 6 hours).

## Cost

Searches per month = keywords x channels x cycles per day x 30. With 6 keywords, 2 channels and a cycle every 3 hours, that is about 2,900 searches a month. Free allowances on most search APIs are smaller than that, so raise `POLL_INTERVAL_MINUTES`, use `CHANNELS=web`, or pause keywords if you hit a limit.

## Limits worth knowing

- Facebook and X are searched through the search engine, so only public posts that the engine has indexed appear, often with a delay of days. Private groups, profiles and most comments are not visible.
- Adding X directly (an unofficial scraper first, the official API later) means adding a new file in `src/sources/` that returns the same item shape as `websearch.js` and calling it from `src/run.js`. The mentions table already has room for tweet IDs and raw payloads.

## Layout

```
db/schema.sql          tables: keywords, mentions
src/config.js          settings from .env
src/providers/         one file per search API (serper, serpapi, brave)
src/sources/           websearch.js builds queries per channel and normalizes results
src/filter/            decides what is worth an alert (exclude list now, LLM later)
src/notify/telegram.js sends alerts
src/run.js             one cycle: search, save, filter, send
src/index.js           the scheduler loop
src/cli.js             keyword management and test commands
```
