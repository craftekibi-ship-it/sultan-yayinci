// Meta Graph API istemcisi (v25.0, mid-2026 dogrulanmis).
// FB Sayfasi + Instagram Isletme hesabi, Facebook Login yolu (host graph.facebook.com).
// Referans brief: SULTAN-YAYINCI-KURULUM.md icindeki API notlari.
import { config } from './config.js';

const GRAPH = `https://graph.facebook.com/${config.graphVersion}`;

// Graph API hata nesnesini okunur mesaja cevirir.
function graphError(path, body) {
  const e = body?.error || {};
  const parts = [
    `Graph hatasi (${path})`,
    e.message ? `mesaj: ${e.message}` : '',
    e.code !== undefined ? `code: ${e.code}` : '',
    e.error_subcode !== undefined ? `subcode: ${e.error_subcode}` : '',
    e.error_user_title ? `baslik: ${e.error_user_title}` : '',
    e.error_user_msg ? `aciklama: ${e.error_user_msg}` : '',
  ].filter(Boolean);
  const err = new Error(parts.join(' | '));
  err.graph = e;
  err.isTokenError = e.code === 190; // token gecersiz/suresi doldu
  return err;
}

// Yayin islemleri (FB Sayfa + IG) SAYFA erisim token'i ister. Onu System User
// token'indan turetip cache'liyoruz (uzun omurlu, cunku kaynak token suresiz).
let _pageToken = null;
async function pageToken() {
  if (_pageToken) return _pageToken;
  if (!config.pageId || !config.token) return config.token;
  try {
    const url = new URL(`${GRAPH}/${config.pageId}`);
    url.searchParams.set('access_token', config.token);
    url.searchParams.set('fields', 'access_token');
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (body?.access_token) _pageToken = body.access_token;
  } catch { /* olmazsa kaynak token'a dus */ }
  return _pageToken || config.token;
}

// token verilmezse Sayfa token'i kullanilir (yayin icin dogru olan).
async function graphGet(path, params = {}, token) {
  const t = token || (await pageToken());
  const url = new URL(`${GRAPH}/${path}`);
  url.searchParams.set('access_token', t);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { method: 'GET' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw graphError(path, body);
  return body;
}

async function graphPost(path, params = {}, token) {
  const t = token || (await pageToken());
  const form = new URLSearchParams();
  form.set('access_token', t);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    form.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw graphError(path, body);
  return body;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Kesif / saglik ----------

// Token gecerli mi + hangi kimlik? (kaynak System User token'i ile)
export async function whoAmI() {
  return graphGet('me', { fields: 'id,name' }, config.token);
}

// Kullanicinin yonettigi sayfalar (PAGE_ID bulmak icin).
export async function getMeAccounts() {
  const body = await graphGet('me/accounts', { fields: 'id,name,access_token,tasks' }, config.token);
  return body.data || [];
}

// Sayfaya bagli Instagram Isletme hesabi ID'si.
export async function getIgUserId(pageId) {
  const body = await graphGet(pageId, { fields: 'instagram_business_account,name' });
  return body?.instagram_business_account?.id || null;
}

// Gercek IG id'sini Sayfadan cozer (kaynak dogru: Sayfaya bagli IG). config.igUserId
// yanlis/eksik yazilmis olsa bile Sayfadan gelen dogru id kullanilir. Cache'lenir.
let _igId = null;
export async function effectiveIgId() {
  if (_igId) return _igId;
  if (config.pageId) {
    try {
      const id = await getIgUserId(config.pageId);
      if (id) { _igId = id; return _igId; }
    } catch { /* olmazsa config'e dus */ }
  }
  return config.igUserId || null;
}

// IG hesabina dogrudan erisim testi (instagram_basic calisiyor mu?).
export async function getIgInfo(igUserId) {
  const body = await graphGet(igUserId, { fields: 'username,name' });
  return { username: body.username || null, name: body.name || null };
}

// Sayfa uzerinden tani: token Sayfayi okuyabiliyor mu + Sayfaya bagli IG id'si + sayfa token'i var mi.
export async function getPageInfo(pageId) {
  const body = await graphGet(pageId, { fields: 'name,instagram_business_account,access_token' });
  return {
    name: body.name || null,
    igId: body?.instagram_business_account?.id || null,
    hasPageToken: !!body.access_token,
  };
}

// IG 24 saatlik yayin kotasi (100/gun).
export async function getIgPublishLimit(igUserId) {
  const body = await graphGet(`${igUserId}/content_publishing_limit`, {
    fields: 'config,quota_usage',
  });
  const row = body?.data?.[0] || {};
  return {
    used: row.quota_usage ?? null,
    total: row?.config?.quota_total ?? 100,
  };
}

// Container durumu (video/story-video icin zorunlu; gorsel icin tavsiye).
export async function getContainerStatus(containerId) {
  const body = await graphGet(containerId, { fields: 'status_code,status' });
  return body.status_code || 'UNKNOWN';
}

// Container FINISHED olana kadar bekler. required=true (video) ise ERROR/timeout atar.
async function waitForContainer(containerId, { required = false, maxMs = 90000, everyMs = 5000 } = {}) {
  const deadline = Date.now() + maxMs;
  let last = 'UNKNOWN';
  while (Date.now() < deadline) {
    last = await getContainerStatus(containerId);
    if (last === 'FINISHED') return true;
    if (last === 'ERROR' || last === 'EXPIRED') {
      throw new Error(`Container ${containerId} durumu: ${last}`);
    }
    if (!required && (last === 'IN_PROGRESS' || last === 'PUBLISHED')) {
      // Gorsellerde IN_PROGRESS cogu zaman aninda gecer; kisa bekle, sonra devam.
      await sleep(2000);
      const again = await getContainerStatus(containerId);
      if (again === 'FINISHED' || again === 'IN_PROGRESS') return true;
    }
    await sleep(everyMs);
  }
  if (required) throw new Error(`Container ${containerId} zaman asimi (son durum: ${last})`);
  return true; // gorsel: yine de yayin denenir
}

// ---------- Facebook Sayfasi ----------

// Metin gonderisi. scheduledUnix verilirse native zamanlama (unix SANIYE, UTC).
export async function fbTextPost(pageId, message, { link, scheduledUnix } = {}) {
  const params = { message };
  if (link) params.link = link;
  if (scheduledUnix) {
    params.published = false;
    params.scheduled_publish_time = scheduledUnix;
  }
  return graphPost(`${pageId}/feed`, params);
}

// Public URL'den fotograf gonderisi. DIKKAT: caption= (message DEGIL).
export async function fbPhotoPost(pageId, imageUrl, caption, { scheduledUnix } = {}) {
  const params = { url: imageUrl, caption: caption || '' };
  if (scheduledUnix) {
    params.published = false;
    params.scheduled_publish_time = scheduledUnix;
  } else {
    params.published = true;
  }
  return graphPost(`${pageId}/photos`, params);
}

// Cok fotografli FB gonderisi: once yayinsiz yukle, sonra feed'e ekle.
export async function fbMultiPhotoPost(pageId, imageUrls, message, { scheduledUnix } = {}) {
  const ids = [];
  for (const url of imageUrls) {
    const r = await graphPost(`${pageId}/photos`, { url, published: false });
    ids.push({ media_fbid: r.id });
  }
  const params = { message: message || '', attached_media: ids };
  if (scheduledUnix) {
    params.published = false;
    params.scheduled_publish_time = scheduledUnix;
  }
  return graphPost(`${pageId}/feed`, params);
}

// ---------- Instagram ----------

// Tek gorsel feed gonderisi (2 adim).
export async function igImagePost(igUserId, imageUrl, caption) {
  const c = await graphPost(`${igUserId}/media`, { image_url: imageUrl, caption: caption || '' });
  await waitForContainer(c.id, { required: false });
  return graphPost(`${igUserId}/media_publish`, { creation_id: c.id });
}

// Carousel (2-10 gorsel = TEK gonderi). caption parent'a gider, oranlar ayni olmali.
export async function igCarouselPost(igUserId, imageUrls, caption) {
  const children = [];
  for (const url of imageUrls) {
    const child = await graphPost(`${igUserId}/media`, { image_url: url, is_carousel_item: true });
    children.push(child.id);
  }
  const parent = await graphPost(`${igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: children.join(','),
    caption: caption || '',
  });
  await waitForContainer(parent.id, { required: false });
  return graphPost(`${igUserId}/media_publish`, { creation_id: parent.id });
}

// Gorsel story. caption STORIES'te YOK SAYILIR (metni gorselin uzerine bas).
export async function igStoryPost(igUserId, imageUrl) {
  const c = await graphPost(`${igUserId}/media`, { media_type: 'STORIES', image_url: imageUrl });
  await waitForContainer(c.id, { required: false });
  return graphPost(`${igUserId}/media_publish`, { creation_id: c.id });
}

export { GRAPH };
