import { config } from '../config.js';
import * as serper from './serper.js';
import * as serpapi from './serpapi.js';
import * as brave from './brave.js';

// Every provider exports search({ query, country, lookback, num })
// and returns [{ title, url, snippet, date, raw }].
// To add another provider, create a file like serper.js and register it here.
const providers = { serper, serpapi, brave };

export function getProvider() {
  const provider = providers[config.search.provider];
  if (!provider) {
    throw new Error(
      `Unknown SEARCH_PROVIDER "${config.search.provider}". Use one of: ${Object.keys(providers).join(', ')}`
    );
  }
  return provider;
}
