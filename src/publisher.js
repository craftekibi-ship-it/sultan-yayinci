// Tek bir plan ogesini secili platformlara yayinlar.
// Guvenlik: kilit kontrolu, DRY_RUN, idempotency (state.js) burada uygulanir.
import { config, assertUnlocked } from './config.js';
import * as graph from './graph.js';
import { markResult, log } from './state.js';

// Bir medya dosya adini public URL'ye cevirir (Meta bu URL'yi ceker).
function mediaUrl(filename) {
  return `${config.publicBaseUrl}/media/${encodeURIComponent(filename)}`;
}

// caption + hashtag birlestir. caption string veya {en,tr,ru} olabilir.
function buildCaption(item) {
  let text = '';
  if (typeof item.caption === 'string') {
    text = item.caption;
  } else if (item.caption && typeof item.caption === 'object') {
    text = [item.caption.en, item.caption.tr, item.caption.ru].filter(Boolean).join('\n\n');
  }
  const tags = Array.isArray(item.hashtags) && item.hashtags.length
    ? '\n\n' + item.hashtags.join(' ')
    : '';
  return (text + tags).trim();
}

function mediaUrls(item) {
  const files = Array.isArray(item.media) ? item.media : item.media ? [item.media] : [];
  return files.map(mediaUrl);
}

// Instagram'a yayinla.
async function publishInstagram(item, caption, urls) {
  const igId = await graph.effectiveIgId(); // dogru IG id Sayfadan cozulur
  if (!igId) throw new Error('IG hesabi cozulemedi (PAGE_ID/IG baglantisi kontrol)');
  const type = item.type || 'feed';
  if (type === 'story') {
    const results = [];
    for (const u of urls) results.push(await graph.igStoryPost(igId, u));
    return { platform: 'instagram', type, results };
  }
  if (type === 'carousel' || urls.length > 1) {
    return { platform: 'instagram', type: 'carousel', results: [await graph.igCarouselPost(igId, urls, caption)] };
  }
  return { platform: 'instagram', type: 'feed', results: [await graph.igImagePost(igId, urls[0], caption)] };
}

// Facebook Sayfasina yayinla.
async function publishFacebook(item, caption, urls) {
  if (!config.pageId) throw new Error('PAGE_ID tanimli degil');
  const type = item.type || 'feed';
  if (type === 'story') {
    // FB Sayfa story'si API ile pratik degil; story ogelerinde FB atlanir.
    log('warn', `FB atlandi (story tipi API ile desteklenmiyor): ${item.id}`);
    return { platform: 'facebook', type, skipped: true };
  }
  if (urls.length > 1) {
    return { platform: 'facebook', type: 'album', results: [await graph.fbMultiPhotoPost(config.pageId, urls, caption)] };
  }
  return { platform: 'facebook', type: 'photo', results: [await graph.fbPhotoPost(config.pageId, urls[0], caption)] };
}

// Bir ogeyi yayinla. force=true zamanlamayi yok sayar (canary/manuel test).
export async function publishItem(item, { force = false } = {}) {
  const caption = buildCaption(item);
  const urls = mediaUrls(item);

  if (!urls.length) throw new Error(`${item.id}: medya yok`);
  if (!config.publicBaseUrl) throw new Error('PUBLIC_BASE_URL bos; Meta gorseli ceker, bu sart');

  const platforms = Array.isArray(item.platforms) && item.platforms.length
    ? item.platforms
    : ['instagram', 'facebook'];

  // --- DRY_RUN: gercek paylasim yok, sadece ne yapilacagi loglanir ---
  if (config.dryRun) {
    log('info', `[DENEME] ${item.id} -> ${platforms.join('+')} (${item.type || 'feed'}), ${urls.length} gorsel`, {
      urls, captionPreview: caption.slice(0, 120),
    });
    return { id: item.id, dryRun: true, platforms, urls };
  }

  // --- GERCEK YAYIN: once guvenlik kilidi ---
  assertUnlocked();

  const results = [];
  const errors = [];
  for (const p of platforms) {
    try {
      if (p === 'instagram') results.push(await publishInstagram(item, caption, urls));
      else if (p === 'facebook') results.push(await publishFacebook(item, caption, urls));
      else log('warn', `Bilinmeyen platform atlandi: ${p}`);
    } catch (e) {
      errors.push({ platform: p, message: e.message, tokenError: !!e.isTokenError });
      log('error', `${item.id} ${p} yayin hatasi: ${e.message}`);
    }
  }

  const ok = errors.length === 0;
  markResult(item.id, ok ? 'published' : 'failed', { results, errors, force });
  log(ok ? 'info' : 'error', `${item.id} yayin ${ok ? 'TAMAM' : 'HATALI'} (${platforms.join('+')})`);
  return { id: item.id, ok, results, errors };
}
