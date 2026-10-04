import { config } from './config.js';
import { runCycle } from './run.js';
import { close } from './db.js';
import { sleep } from './util.js';

const once = process.argv.includes('--once');

async function safeCycle() {
  try {
    await runCycle();
  } catch (e) {
    console.error(new Date().toISOString(), 'cycle error:', e.message || e.code || e);
  }
}

process.on('SIGINT', async () => {
  await close().catch(() => {});
  process.exit(0);
});

if (once) {
  await safeCycle();
  await close();
} else {
  console.log(
    `Listener started. Channels: ${config.search.channels.join(', ')}. ` +
      `Cycle every ${config.pollIntervalMinutes} min.`
  );
  for (;;) {
    await safeCycle();
    // A little random jitter so requests don't land on an exact schedule.
    const jitter = 0.9 + Math.random() * 0.2;
    await sleep(config.pollIntervalMinutes * 60_000 * jitter);
  }
}
