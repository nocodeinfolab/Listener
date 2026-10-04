-- Keywords you listen for. Add, pause or remove them any time with:
--   npm run kw -- add "term" | list | on "term" | off "term" | remove "term"
CREATE TABLE IF NOT EXISTS keywords (
  id         SERIAL PRIMARY KEY,
  term       TEXT NOT NULL,
  -- Optional custom search query. If empty, the term itself is searched.
  query      TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS keywords_term_lower_idx ON keywords (lower(term));

-- Everything the listener has found. One row per unique conversation/page.
CREATE TABLE IF NOT EXISTS mentions (
  id           BIGSERIAL PRIMARY KEY,
  -- web | facebook | x  (decided from the URL, so the same page is never stored twice)
  source       TEXT NOT NULL,
  -- Normalized URL for search results. For X API/scraper later: the tweet id.
  external_id  TEXT NOT NULL,
  keyword      TEXT NOT NULL,
  url          TEXT NOT NULL,
  title        TEXT,
  text         TEXT,
  author       TEXT,
  published_at TIMESTAMPTZ,
  -- Original provider payload, so results can be re-processed without refetching.
  raw          JSONB,
  found_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- new = waiting to be sent | sent | filtered (silenced by filter) | skipped (baseline)
  status       TEXT NOT NULL DEFAULT 'new',
  notified_at  TIMESTAMPTZ,
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS mentions_pending_idx ON mentions (found_at) WHERE status = 'new';
