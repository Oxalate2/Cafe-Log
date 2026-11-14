// Shared setup for the Cafe Log tests.
// Every test gets a brand-new browser profile, so the journal (IndexedDB) starts empty.
const { expect } = require('@playwright/test');

const TODAY = '2026-11-13';

// Make the page repeatable: fixed date, seeded Math.random (sticker spots / tilts), no sound.
async function open(page, { seed = 7 } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00`));
  await page.addInitScript(s => {
    let a = s >>> 0;
    Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, seed);
  await page.goto('/');
  await ready(page);
  page.cafeErrors = errors;
  return errors;
}

async function ready(page) {
  await expect(page.locator('#book .leaf')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const act = (page, name) => page.locator(`[data-act="${name}"]`);

// a pastel "photo" made in the page, so no image files are needed
async function photo(page, color = '#c98f6b', label = 'latte') {
  const b64 = await page.evaluate(([c, l]) => {
    const cv = document.createElement('canvas'); cv.width = 600; cv.height = 450;
    const g = cv.getContext('2d');
    g.fillStyle = c; g.fillRect(0, 0, 600, 450);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(300, 225, 120, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3b302b'; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.fillText(l, 300, 245);
    return cv.toDataURL('image/png').split(',')[1];
  }, [color, label]);
  return { name: `${label}.png`, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}

// go to the blank page at the back of the journal
async function toBlankPage(page) {
  for (let i = 0; i < 30; i++) {
    const next = act(page, 'next');
    if (!(await next.isEnabled())) break;
    await next.click();
    await expect(page.locator('#book .turner')).toHaveCount(0); // flip finished
  }
  await expect(act(page, 'new')).toBeVisible();
}

// position (0..1) of a point across an element, for tapping the stars etc.
async function tapAt(page, locator, fx, fy = 0.5) {
  const b = await locator.boundingBox();
  await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
}

async function addCafe(page, { name = 'Hop Cafe', city = 'Arcadia', drink = 'iced matcha', notes = 'cosy corner seat, great playlist',
  rating = 4.5, color = 'orange', date = '2026-11-02', photos = 1 } = {}) {
  await toBlankPage(page);
  await act(page, 'new').click();
  await page.locator('[data-f="date"]').fill(date);
  await page.locator('[data-f="name"]').fill(name);
  await page.locator('[data-f="city"]').fill(city);
  await page.locator('[data-f="drink"]').fill(drink);
  await page.locator('[data-f="notes"]').fill(notes);
  if (photos) {
    const files = [];
    const colors = ['#c98f6b', '#8fbf6a', '#7fa6c9'];
    for (let i = 0; i < photos; i++) files.push(await photo(page, colors[i % 3], ['latte', 'matcha', 'cake'][i % 3]));
    await page.locator('#photo-input').setInputFiles(files);
    await expect(page.locator('#book .ph img')).toHaveCount(photos);
  }
  if (rating) await tapAt(page, page.locator('#book .stars'), (rating - 0.25) / 5);
  if (color) await page.locator(`#book .dot[data-color="${color}"]`).click();
  await save(page);
}

// tap done and wait until the page is stored and redrawn (saving is async, slower on a busy machine)
async function save(page) {
  await act(page, 'save').click();
  await expect(page.locator('#book .page.editing')).toHaveCount(0);
  await expect(act(page, 'edit')).toBeVisible();
}

// everything saved in the browser's storage
async function stored(page) {
  return page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('cafe-log'); r.onsuccess = () => res(r.result); r.onerror = rej; });
    const get = (store, fn) => new Promise(res => { const r = fn(db.transaction(store).objectStore(store)); r.onsuccess = () => res(r.result); });
    const entries = await get('entries', s => s.getAll());
    const cover = await get('meta', s => s.get('cover'));
    db.close();
    return { entries, cover: cover && cover.value };
  });
}

// where an element sits as a % of the journal page (independent of how big the page is drawn)
async function relBox(page, selector) {
  return page.evaluate(sel => {
    const B = document.querySelector('#book').getBoundingClientRect();
    const b = document.querySelector(sel).getBoundingClientRect();
    return { x: (b.x - B.x) / B.width * 100, y: (b.y - B.y) / B.height * 100, w: b.width / B.width * 100 };
  }, selector);
}

module.exports = { TODAY, open, ready, act, save, photo, toBlankPage, tapAt, addCafe, stored, relBox, expect };
