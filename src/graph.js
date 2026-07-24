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

async function graphGet(path, params = {}) {
  const url = new URL(`${GRAPH}/${path}`);
  url.searchParams.set('access_token', config.token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { method: 'GET' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw graphError(path, body);
  return body;
}

async function graphPost(path, params = {}) {
  const form = new URLSearchParams();
  form.set('access_token', config.token);
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

// Token gecerli mi + hangi kimlik? (basit /me cagirisi)
export async function whoAmI() {
  return graphGet('me', { fields: 'id,name' });
}

// Kullanicinin yonettigi sayfalar (PAGE_ID bulmak icin).
export async function getMeAccounts() {
  const body = await graphGet('me/accounts', { fields: 'id,name,access_token,tasks' });
  return body.data || [];
}

// Sayfaya bagli Instagram Isletme hesabi ID'si.
export async function getIgUserId(pageId) {
  const body = await graphGet(pageId, { fields: 'instagram_business_account,name' });
  return body?.instagram_business_account?.id || null;
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
