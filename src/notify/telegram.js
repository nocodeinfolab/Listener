import { requireEnv } from '../config.js';
import { sleep, esc, clip } from '../util.js';

const LABEL = { web: 'Web', facebook: 'Facebook', x: 'X' };

export async function sendTelegram(html, retry = true) {
  const token = requireEnv('TELEGRAM_BOT_TOKEN');
  const chatId = requireEnv('TELEGRAM_CHAT_ID');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  // Telegram asks you to slow down with a 429 and a retry_after in seconds.
  if (res.status === 429 && retry) {
    const data = await res.json().catch(() => ({}));
    await sleep(((data.parameters && data.parameters.retry_after) || 5) * 1000);
    return sendTelegram(html, false);
  }
  if (!res.ok) {
    throw new Error(`Telegram ${res.status}: ${clip(await res.text(), 200)}`);
  }
}

export function formatMention(m) {
  const lines = [`🔎 <b>${esc(LABEL[m.source] || m.source)}</b> · <i>${esc(m.keyword)}</i>`];
  if (m.title) lines.push(`<b>${esc(clip(m.title, 200))}</b>`);
  if (m.text) lines.push(esc(clip(m.text, 400)));
  lines.push(`<a href="${esc(m.url)}">Open conversation</a>`);
  return lines.join('\n');
}
