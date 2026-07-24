// Yayin durumunu ve log'lari data/state.json icinde tutar (idempotency).
// Ayni post iki kez yayinlanmaz: yayinlanan her ogenin id'si burada isaretlenir.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';

const STATE_PATH = path.join(ROOT, 'data', 'state.json');

function ensure() {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STATE_PATH)) {
    fs.writeFileSync(STATE_PATH, JSON.stringify({ items: {}, log: [] }, null, 2));
  }
}

export function readState() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { items: {}, log: [] };
  }
}

function writeState(s) {
  ensure();
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

// Bir ogenin daha once basariyla yayinlanip yayinlanmadigi.
export function isPublished(id) {
  const s = readState();
  return s.items[id]?.status === 'published';
}

export function getItemState(id) {
  return readState().items[id] || null;
}

export function markResult(id, status, detail) {
  const s = readState();
  s.items[id] = {
    ...(s.items[id] || {}),
    status, // 'published' | 'failed'
    detail: detail || null,
    at: new Date().toISOString(),
  };
  writeState(s);
}

export function log(level, message, meta) {
  const s = readState();
  s.log.unshift({ t: new Date().toISOString(), level, message, meta: meta || null });
  s.log = s.log.slice(0, 500); // son 500 kayit
  writeState(s);
  const tag = level === 'error' ? 'HATA' : level === 'warn' ? 'UYARI' : 'BILGI';
  console.log(`[${tag}] ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`);
}
