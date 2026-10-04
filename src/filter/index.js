import { config } from '../config.js';

// Decide whether a result is worth an alert. Return false to silence it
// (it is still stored, with status "filtered", so it is never re-evaluated).
//
// Today this is a simple exclude list from EXCLUDE_TERMS. When you start seeing
// noise, this is the place to add an LLM pass that asks "is this person actually
// asking for or discussing what I care about?" and returns a score and a reason.
export function isRelevant(item) {
  const haystack = `${item.title || ''} ${item.text || ''} ${item.url}`.toLowerCase();
  return !config.excludeTerms.some((term) => haystack.includes(term));
}
