// Token + hesap saglik kontrolu.
//   node src/tools/check-token.js
import { config, lockStatus, missingConfig } from '../config.js';
import { whoAmI, getIgUserId, getIgPublishLimit } from '../graph.js';

const run = async () => {
  console.log('=== Sultan Yayinci - saglik kontrolu ===');
  console.log('Graph surumu:', config.graphVersion);
  console.log('Mod:', config.dryRun ? 'DRY_RUN (deneme)' : 'CANLI', '| PAUSED:', config.paused);

  const miss = missingConfig();
  if (miss.length) console.log('Eksik ayarlar:', miss.join(', '));

  const lock = lockStatus();
  console.log('Guvenlik kilidi:', lock.locked ? 'AKTIF (yayin durur) - ' + lock.problems.join(' | ') : 'acik (yayin serbest)');

  if (!config.token) { console.log('\nToken yok, kontrol durduruldu.'); return; }

  try {
    const me = await whoAmI();
    console.log('\nToken gecerli. Kimlik:', me.name || me.id);
  } catch (e) {
    console.log('\nTOKEN HATASI:', e.message);
    return;
  }

  if (config.pageId) {
    try {
      const ig = await getIgUserId(config.pageId);
      console.log('Sayfaya bagli IG_USER_ID:', ig || '(yok)');
      if (ig) {
        if (config.igUserId && ig !== config.igUserId) {
          console.log('  UYARI: .env IG_USER_ID ile sayfadaki farkli!');
        }
        const lim = await getIgPublishLimit(config.igUserId || ig);
        console.log(`IG 24s yayin kotasi: ${lim.used ?? '?'} / ${lim.total}`);
      }
    } catch (e) {
      console.log('Sayfa/IG kontrol hatasi:', e.message);
    }
  }
  console.log('\nHazir. Canliya gecmeden once: DRY_RUN=false + LOCK_* dolu + bir canary testi.');
};

run().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
