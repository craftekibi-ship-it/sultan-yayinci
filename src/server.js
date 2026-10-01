// Yayinci sunucusu:
//  1) /media/*  -> gorselleri PUBLIC servis eder (Meta bu URL'den ceker, sart)
//  2) /health   -> Coolify saglik kontrolu
//  3) /         -> yonetim paneli (ADMIN_KEY ile)
//  4) cron      -> her N dakikada zamani gelen ogeleri yayinlar
import express from 'express';
import path from 'node:path';
import cron from 'node-cron';
import { fileURLToPath } from 'node:url';
import { config, missingConfig, lockStatus } from './config.js';
import { ROOT } from './config.js';
import { readState } from './state.js';
import { dueItems, upcomingItems, findById, readSchedule } from './scheduler.js';
import { runTick } from './tick.js';
import { publishItem } from './publisher.js';
import { whoAmI, getIgUserId, getIgInfo, getPageInfo, getIgPublishLimit, effectiveIgId } from './graph.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- PUBLIC: gorsel hosting (Meta buradan ceker) ---
app.use('/media', express.static(path.join(ROOT, 'content', 'media'), {
  maxAge: '1h',
  setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=3600'),
}));

// --- PUBLIC: saglik ---
app.get('/health', (_req, res) => res.json({ ok: true, service: 'sultan-yayinci' }));

// --- Auth ---
function auth(req, res, next) {
  const key = req.query.key || req.headers['x-admin-key'];
  if (!config.adminKey) return res.status(500).send('ADMIN_KEY tanimli degil.');
  if (key !== config.adminKey) return res.status(401).send('Yetkisiz. ?key=... gerekli.');
  next();
}

// --- Durum JSON ---
app.get('/api/status', auth, async (req, res) => {
  const state = readState();
  const sched = readSchedule();
  // Token kontrolu: /me basarili ise token GECERLI. IG kontrolleri ayri,
  // basarisiz olsalar bile token'i "hatali" yapmaz.
  let token = { ok: false };
  let pageCheck = null; // Sayfa->IG tanisi (token Sayfayi okuyabiliyor mu, bagli IG id)
  let igCheck = null; // instagram_basic testi (IG hesabini okuyabiliyor mu?)
  let igQuota = null; // instagram_content_publish + yayin kotasi
  try {
    const me = await whoAmI();
    token = { ok: true, name: me.name || me.id };
  } catch (e) {
    token = { ok: false, error: e.message, tokenError: !!e.isTokenError };
  }
  if (token.ok && config.pageId) {
    try { pageCheck = { ok: true, ...(await getPageInfo(config.pageId)) }; }
    catch (e) { pageCheck = { ok: false, error: e.message }; }
  }
  const igId = token.ok ? await effectiveIgId() : null;
  if (igId) {
    try { igCheck = { ok: true, resolvedId: igId, ...(await getIgInfo(igId)) }; }
    catch (e) { igCheck = { ok: false, resolvedId: igId, error: e.message }; }
    try { igQuota = { ok: true, ...(await getIgPublishLimit(igId)) }; }
    catch (e) { igQuota = { ok: false, error: e.message }; }
  }
  const publishedAll = Object.entries(state.items)
    .filter(([, v]) => v.status === 'published')
    .map(([id, v]) => ({ id, at: v.at }))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  const failedAll = Object.entries(state.items)
    .filter(([, v]) => v.status === 'failed')
    .map(([id, v]) => ({ id, at: v.at, detail: v.detail }));
  // Sayaclar tum gecmisi sayar, listeler son 15 ile sinirli (panel kisa kalsin)
  const published = publishedAll.slice(0, 15);
  const failed = failedAll.slice(0, 15);
  res.json({
    mode: { dryRun: config.dryRun, paused: config.paused, tz: config.tz, graphVersion: config.graphVersion },
    config: { missing: missingConfig(), lock: lockStatus(), pageId: config.pageId, igUserId: config.igUserId, publicBaseUrl: config.publicBaseUrl },
    token,
    pageCheck,
    igCheck,
    igQuota,
    totals: { planned: (sched.items || []).length, published: publishedAll.length, failed: failedAll.length },
    due: dueItems().map(({ item, when }) => ({ id: item.id, when })),
    upcoming: upcomingItems().map(({ item, when }) => ({ id: item.id, when, type: item.type || 'feed', platforms: item.platforms || ['instagram', 'facebook'] })),
    published,
    failed,
    log: state.log.slice(0, 30),
  });
});

// --- Manuel tick ---
app.post('/api/tick', auth, async (_req, res) => {
  try { res.json(await runTick()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Canary: tek ogeyi zorla yayinla (DRY_RUN'a saygi duyar) ---
app.post('/api/canary', auth, async (req, res) => {
  const id = req.body.id || req.query.id;
  const item = findById(id);
  if (!item) return res.status(404).json({ error: `Oge bulunamadi: ${id}` });
  try { res.json(await publishItem(item, { force: true })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Panel (statik HTML, veriyi /api/status'tan ceker) ---
app.get('/', auth, (req, res) => {
  res.type('html').send(dashboardHtml(req.query.key));
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Sultan Yayinci ${config.dryRun ? '[DENEME]' : '[CANLI]'} port ${PORT} - mod ${config.tz}`);
  const miss = missingConfig();
  if (miss.length) console.log('Eksik ayar:', miss.join(', '));
});

// --- Cron ---
if (cron.validate(config.tickCron)) {
  cron.schedule(config.tickCron, async () => {
    try { await runTick(); } catch (e) { console.error('cron tick hata:', e.message); }
  }, { timezone: config.tz });
  console.log('Cron kuruldu:', config.tickCron, config.tz);
} else {
  console.error('Gecersiz TICK_CRON:', config.tickCron);
}

function dashboardHtml(key) {
  const k = JSON.stringify(key || '');
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sultan Yayinci</title>
<style>
:root{--ink:#0b0906;--gold:#c9a45c;--cream:#ede4d3;--card:#14100b;--line:#2a2118;--ok:#5fb87a;--bad:#d9694f;--warn:#d7a34a}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--cream);font:15px/1.5 -apple-system,system-ui,Segoe UI,Roboto,sans-serif}
.wrap{max-width:860px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:20px;letter-spacing:.02em;margin:0 0 2px}.sub{color:#9b9081;font-size:13px;margin-bottom:18px}
.badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600}
.b-live{background:#3a1d16;color:#f0b3a3;border:1px solid #6b2f22}.b-dry{background:#123018;color:#a7e0bb;border:1px solid #285e39}
.b-pause{background:#3a2f12;color:#e8cd8a;border:1px solid #6b551f}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:12px 0}
.card h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--gold);margin:0 0 10px}
.row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed #241c13}.row:last-child{border:0}
.mono{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#c8bca9}
.k{color:#9b9081}.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}
button{background:var(--gold);color:#1a1206;border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;font-size:14px}
button.ghost{background:transparent;color:var(--gold);border:1px solid var(--gold)}
.btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}
small{color:#8a8072}ul{margin:6px 0;padding-left:18px}li{margin:3px 0}
.pill{font-size:11px;padding:1px 7px;border-radius:999px;background:#241c13;color:#b7a888;margin-left:6px}
</style></head><body><div class="wrap">
<h1>Sultan Grill House Yayinci</h1><div class="sub">Meta otomatik paylasim paneli</div>
<div id="app">Yukleniyor...</div>
</div>
<script>
const KEY=${k};
const q=(u,o)=>fetch(u+(u.includes('?')?'&':'?')+'key='+encodeURIComponent(KEY),o).then(r=>r.json());
const esc=s=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const dt=s=>s?new Date(s).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'-';
async function load(){
  let d;try{d=await q('/api/status')}catch(e){document.getElementById('app').innerHTML='<div class=card>Yuklenemedi</div>';return}
  const m=d.mode, modeBadge=m.paused?'<span class="badge b-pause">DURDURULDU</span>':(m.dryRun?'<span class="badge b-dry">DENEME (yayin yok)</span>':'<span class="badge b-live">CANLI</span>');
  const tok=d.token.ok?'<span class="ok">gecerli ('+esc(d.token.name)+')</span>':'<span class="bad">HATA: '+esc(d.token.error||'yok')+'</span>';
  const lock=d.config.lock.locked?'<span class="warn">AKTIF - '+esc(d.config.lock.problems.join(' | '))+'</span>':'<span class="ok">acik</span>';
  const miss=d.config.missing.length?'<span class="bad">'+d.config.missing.join(', ')+'</span>':'<span class="ok">tam</span>';
  const pgc=d.pageCheck?(d.pageCheck.ok?'<span class="ok">'+esc(d.pageCheck.name||'?')+'</span> <small>(bagli IG: '+esc(d.pageCheck.igId||'yok')+')</small>':'<span class="bad">HATA: '+esc(d.pageCheck.error||'')+'</span>'):'';
  const igc=d.igCheck?(d.igCheck.ok?'<span class="ok">erisiliyor (@'+esc(d.igCheck.username||'?')+')</span>':'<span class="bad">HATA: '+esc(d.igCheck.error||'')+'</span>'):'';
  const quota=d.igQuota?(d.igQuota.ok?'kota '+(d.igQuota.used??'?')+' / '+d.igQuota.total:'<span class="warn">kota okunamadi: '+esc(d.igQuota.error||'')+'</span>'):'';
  let h='';
  h+='<div class=card><div class=row><span class=k>Mod</span><span>'+modeBadge+'</span></div>'+
     '<div class=row><span class=k>Token</span><span>'+tok+'</span></div>'+
     '<div class=row><span class=k>Guvenlik kilidi</span><span>'+lock+'</span></div>'+
     '<div class=row><span class=k>Ayarlar</span><span>'+miss+'</span></div>'+
     '<div class=row><span class=k>PAGE_ID / IG_USER_ID</span><span class=mono>'+esc(d.config.pageId||'-')+' / '+esc(d.config.igUserId||'-')+'</span></div>'+
     (pgc?'<div class=row><span class=k>Sayfa erisim</span><span>'+pgc+'</span></div>':'')+
     (igc?'<div class=row><span class=k>Instagram erisim</span><span>'+igc+'</span></div>':'')+
     (quota?'<div class=row><span class=k>Instagram kota</span><span>'+quota+'</span></div>':'')+
     '<div class=row><span class=k>Plan / Yayinlanan / Hatali</span><span>'+d.totals.planned+' / <span class=ok>'+d.totals.published+'</span> / <span class=bad>'+d.totals.failed+'</span></span></div>'+
     '<div class=btns><button onclick=tick()>Simdi kontrol et</button></div></div>';
  h+='<div class=card><h2>Zamani gelenler ('+d.due.length+')</h2>'+(d.due.length?'<ul>'+d.due.map(x=>'<li class=mono>'+esc(x.id)+' <small>'+dt(x.when)+'</small></li>').join(''):'<small>yok</small>')+'</ul></div>';
  h+='<div class=card><h2>Yaklasan ('+d.upcoming.length+')</h2>'+(d.upcoming.length?'<ul>'+d.upcoming.map(x=>'<li class=mono>'+esc(x.id)+'<span class=pill>'+esc(x.type)+'</span><span class=pill>'+esc((x.platforms||[]).join('+'))+'</span> <small>'+dt(x.when)+'</small> <button class=ghost style="padding:2px 8px;font-size:11px" onclick="canary(\\''+esc(x.id)+'\\')">test yayinla</button></li>').join(''):'<small>yok</small>')+'</ul></div>';
  if(d.failed.length)h+='<div class=card><h2>Hatalilar</h2><ul>'+d.failed.map(x=>'<li class="mono bad">'+esc(x.id)+' <small>'+dt(x.at)+'</small></li>').join('')+'</ul></div>';
  h+='<div class=card><h2>Son yayinlar</h2>'+(d.published.length?'<ul>'+d.published.map(x=>'<li class=mono>'+esc(x.id)+' <small>'+dt(x.at)+'</small></li>').join(''):'<small>henuz yok</small>')+'</ul></div>';
  h+='<div class=card><h2>Log</h2>'+d.log.map(l=>'<div class="row"><span class="mono '+(l.level==='error'?'bad':l.level==='warn'?'warn':'')+'">'+esc(l.message)+'</span><small>'+dt(l.t)+'</small></div>').join('')+'</div>';
  document.getElementById('app').innerHTML=h;
}
async function tick(){await q('/api/tick',{method:'POST'});load()}
async function canary(id){if(!confirm(id+' ogesini SIMDI yayinlamak icin dene? (Mod DENEME ise gercek paylasim olmaz)'))return;const r=await q('/api/canary?id='+encodeURIComponent(id),{method:'POST'});alert(JSON.stringify(r,null,2));load()}
load();setInterval(load,60000);
</script></body></html>`;
}
