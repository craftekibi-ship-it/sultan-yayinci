// Yayin planini (content/schedule.json) okur ve zamani gelen ogeleri bulur.
// Zaman dilimi Europe/Istanbul (kutuphane yok; Intl ile UTC'ye cevrilir).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, config } from './config.js';
import { isPublished } from './state.js';

const SCHEDULE_PATH = path.join(ROOT, 'content', 'schedule.json');

export function readSchedule() {
  if (!fs.existsSync(SCHEDULE_PATH)) return { items: [] };
  try {
    return JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
  } catch (e) {
    throw new Error(`schedule.json okunamadi: ${e.message}`);
  }
}

// Belirli bir tz'de verilen duvar-saatinin UTC karsiligi.
function tzOffsetMs(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const map = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second);
  return asUTC - date.getTime();
}

// "2026-08-01" + "20:00" + "Europe/Istanbul" -> gercek UTC Date.
export function zonedToUtc(dateStr, timeStr, tz = config.tz) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = (timeStr || '00:00').split(':').map(Number);
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const offset = tzOffsetMs(new Date(utcGuess), tz);
  return new Date(utcGuess - offset);
}

export function itemWhenUtc(item) {
  return zonedToUtc(item.date, item.time || '20:00', item.tz || config.tz);
}

export function unixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

// Su an yayinlanmasi gereken ogeler:
//  - status pending (veya bos) ve daha once basariyla yayinlanmamis
//  - planlanan an <= simdi
//  - gecikme, catchup penceresinden (dakika) daha eski DEGIL
export function dueItems(now = new Date()) {
  const sched = readSchedule();
  const graceMs = config.catchupGraceMin * 60 * 1000;
  const due = [];
  for (const item of sched.items || []) {
    if (!item.id) continue;
    if (item.status === 'skip' || item.status === 'published') continue;
    if (isPublished(item.id)) continue;
    const when = itemWhenUtc(item);
    const diff = now.getTime() - when.getTime();
    if (diff >= 0 && diff <= graceMs) due.push({ item, when });
  }
  // En eski once
  due.sort((a, b) => a.when - b.when);
  return due;
}

// Yaklasan (henuz zamani gelmemis) ogeler - panelde gostermek icin.
export function upcomingItems(now = new Date(), limit = 20) {
  const sched = readSchedule();
  const list = (sched.items || [])
    .filter((i) => i.id && i.status !== 'skip')
    .map((i) => ({ item: i, when: itemWhenUtc(i) }))
    .filter((x) => x.when.getTime() > now.getTime() && !isPublished(x.item.id))
    .sort((a, b) => a.when - b.when)
    .slice(0, limit);
  return list;
}

export function findById(id) {
  const sched = readSchedule();
  return (sched.items || []).find((i) => i.id === id) || null;
}
