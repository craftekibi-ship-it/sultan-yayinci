// Zamanlayici tetikleyici. Cron her N dakikada bir bunu cagirir.
//   node src/tick.js            -> zamani gelen tum ogeleri yayinla
//   node src/tick.js --only ID  -> tek ogeyi zorla yayinla (canary/test)
//   node src/tick.js --list     -> due + yaklasan ogeleri listele
import { config, missingConfig, lockStatus } from './config.js';
import { dueItems, upcomingItems, findById, itemWhenUtc } from './scheduler.js';
import { publishItem } from './publisher.js';
import { log } from './state.js';

export async function runTick() {
  if (config.paused) {
    log('warn', 'PAUSED=true, yayin durduruldu.');
    return { paused: true, published: [] };
  }
  const due = dueItems();
  if (!due.length) return { published: [] };
  log('info', `${due.length} oge zamaninda, yayinlaniyor...`);
  const published = [];
  for (const { item } of due) {
    try {
      published.push(await publishItem(item));
    } catch (e) {
      log('error', `tick: ${item.id} yayinlanamadi: ${e.message}`);
    }
  }
  return { published };
}

// CLI olarak calistirildiginda
const isMain = process.argv[1] && process.argv[1].endsWith('tick.js');
if (isMain) {
  const args = process.argv.slice(2);
  const run = async () => {
    if (args[0] === '--list') {
      const miss = missingConfig();
      const lock = lockStatus();
      console.log('Mod:', config.dryRun ? 'DRY_RUN (deneme)' : 'CANLI', '| PAUSED:', config.paused);
      if (miss.length) console.log('Eksik ayar:', miss.join(', '));
      if (lock.locked) console.log('KILIT:', lock.problems.join(' | '));
      const due = dueItems();
      console.log(`\nSimdi yayinlanacak (${due.length}):`);
      due.forEach(({ item, when }) => console.log(`  ${item.id}  @ ${when.toISOString()}`));
      const up = upcomingItems();
      console.log(`\nYaklasan (${up.length}):`);
      up.forEach(({ item, when }) => console.log(`  ${item.id}  @ ${when.toISOString()} (${item.type || 'feed'}, ${item.platforms?.join('+') || 'ig+fb'})`));
      return;
    }
    if (args[0] === '--only') {
      const id = args[1];
      if (!id) { console.error('Kullanim: node src/tick.js --only <id>'); process.exit(1); }
      const item = findById(id);
      if (!item) { console.error(`Oge bulunamadi: ${id}`); process.exit(1); }
      console.log(`Zorla yayin: ${id} (mod: ${config.dryRun ? 'DENEME' : 'CANLI'})`);
      const r = await publishItem(item, { force: true });
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    const r = await runTick();
    console.log(JSON.stringify(r, null, 2));
  };
  run().catch((e) => { console.error(e); process.exit(1); });
}
