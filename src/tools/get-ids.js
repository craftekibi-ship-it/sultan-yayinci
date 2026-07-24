// Token'i .env'e koyduktan sonra calistir: PAGE_ID ve IG_USER_ID'yi bulur.
//   node src/tools/get-ids.js
import { config } from '../config.js';
import { whoAmI, getMeAccounts, getIgUserId } from '../graph.js';

const run = async () => {
  if (!config.token) {
    console.error('PAGE_ACCESS_TOKEN bos. Once .env icine token yaz.');
    process.exit(1);
  }
  console.log('Token kimligi kontrol ediliyor...');
  const me = await whoAmI();
  console.log('  ->', me.name || me.id, `(id ${me.id})`);

  console.log('\nYonetilen sayfalar:');
  const pages = await getMeAccounts();
  if (!pages.length) console.log('  (sayfa bulunamadi - token sayfa yetkisi tasimyor olabilir)');
  for (const p of pages) {
    let ig = null;
    try { ig = await getIgUserId(p.id); } catch { /* yoksa gec */ }
    console.log(`\n  Sayfa: ${p.name}`);
    console.log(`    PAGE_ID     = ${p.id}`);
    console.log(`    IG_USER_ID  = ${ig || '(bagli IG isletme hesabi yok)'}`);
  }
  console.log('\nDogru sayfanin PAGE_ID ve IG_USER_ID degerlerini .env icine (ve LOCK_* alanlarina) yaz.');
};

run().catch((e) => { console.error('\nHATA:', e.message); process.exit(1); });
