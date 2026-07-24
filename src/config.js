// Ortam degiskenlerini yukler + guvenlik kilidini uygular.
// Harici bagimlilik yok: .env varsa elle okunur (Coolify zaten process.env doldurur).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

// Yerel calistirmada .env dosyasini oku (Coolify'da gerek yok).
(function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
})();

const bool = (v, def = false) => {
  if (v === undefined || v === null || v === '') return def;
  return String(v).toLowerCase() === 'true' || v === '1';
};

export const config = {
  pageId: process.env.PAGE_ID || '',
  igUserId: process.env.IG_USER_ID || '',
  token: process.env.PAGE_ACCESS_TOKEN || '',
  graphVersion: process.env.GRAPH_VERSION || 'v25.0',

  lockPageId: process.env.LOCK_PAGE_ID || '',
  lockIgUserId: process.env.LOCK_IG_USER_ID || '',
  lockIgUsername: process.env.LOCK_IG_USERNAME || 'sultangrillhouse_sultanahmet',

  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),

  dryRun: bool(process.env.DRY_RUN, true),
  paused: bool(process.env.PAUSED, false),

  tz: process.env.TZ || 'Europe/Istanbul',
  tickCron: process.env.TICK_CRON || '*/5 * * * *',
  catchupGraceMin: parseInt(process.env.CATCHUP_GRACE_MIN || '120', 10),

  adminKey: process.env.ADMIN_KEY || '',
  port: parseInt(process.env.PORT || '3000', 10),
};

// --- Guvenlik kilidi: yanlis hesaba yayini engelle ---
// Hedef PAGE_ID / IG_USER_ID, LOCK_* ile ayni degilse yayinci "kilitli" sayilir ve
// gercek paylasim yapmaz. Bu, Esto'daki "yanlis sayfaya yayin" kazasini onler.
export function lockStatus() {
  const problems = [];
  if (!config.lockPageId || !config.lockIgUserId) {
    problems.push('LOCK_PAGE_ID veya LOCK_IG_USER_ID bos. Guvenlik kilidi icin doldur.');
  }
  if (config.lockPageId && config.pageId && config.lockPageId !== config.pageId) {
    problems.push(`PAGE_ID (${config.pageId}) kilitle (${config.lockPageId}) uyusmuyor.`);
  }
  if (config.lockIgUserId && config.igUserId && config.lockIgUserId !== config.igUserId) {
    problems.push(`IG_USER_ID (${config.igUserId}) kilitle (${config.lockIgUserId}) uyusmuyor.`);
  }
  return { locked: problems.length > 0, problems };
}

// Yayin oncesi cagrilir; kilit sorunu varsa hata firlatir.
export function assertUnlocked() {
  const { locked, problems } = lockStatus();
  if (locked) {
    throw new Error('GUVENLIK KILIDI AKTIF - yayin durduruldu:\n - ' + problems.join('\n - '));
  }
}

export function missingConfig() {
  const miss = [];
  if (!config.pageId) miss.push('PAGE_ID');
  if (!config.igUserId) miss.push('IG_USER_ID');
  if (!config.token) miss.push('PAGE_ACCESS_TOKEN');
  if (!config.publicBaseUrl) miss.push('PUBLIC_BASE_URL');
  if (!config.adminKey) miss.push('ADMIN_KEY');
  return miss;
}
