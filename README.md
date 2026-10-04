# Listener

Searches the web (including public Facebook and X posts, via `site:` searches) for your keywords on a schedule, stores what it finds in Postgres, and sends new results to you on Telegram. You then open the link and join the conversation yourself.

## Status

Working today:
- Web search via Serper (SerpApi and Brave also implemented).
- Facebook via `site:facebook.com` (public, indexed posts only — see Limits).
- Telegram alerts, keyword management, dedupe, health alerts.

Planned / in progress:
- **Reddit** — needs approval under Reddit's Responsible Builder Policy (self-service API access closed Nov 2025). Approval request submitted. Source file not yet written.
- **X / Twitter** — not built. Plan: unofficial open-source scraper on a burner account first, official API later. See Limits.
- **Nairaland** and other Nigerian sources — planned, via `site:` search to start.
- **`channels` table** — moving channel scope out of `.env` and into the database, so keywords and places are each managed in one spot.

## Setup

You need Node 18+ and a Postgres database.

1. Create a database and a role that owns it. Example (adjust the port to match your server):

   ```bash
   sudo -u postgres psql -p 5434
