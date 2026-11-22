// Browser tests: use the app the way a person would, then check what it shows and what it saved.
const { test } = require('@playwright/test');
const { open, act, save, photo, toBlankPage, tapAt, addCafe, stored, relBox, expect } = require('./helpers');

const letters = loc => loc.evaluate(n => n.textContent.toLowerCase().replace(/\s+/g, ''));

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function drag(page, locator, dx, dy) {
  const b = await locator.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y + (dy * i) / 8);
  await page.mouse.up();
}

test.describe('opening the journal', () => {
  test('cover loads with the ransom title and no errors', async ({ page }) => {
    const errors = await open(page);
    await expect(page.locator('#book .leaf.cover')).toBeVisible();
    expect(await letters(page.locator('.cover-title'))).toBe('cafelog');
    await expect(page.locator('.cover-title .rl')).toHaveCount(7);
    await expect(page.locator('.page-count')).toHaveText('cover');
    await expect(page.locator('#book')).not.toContainText('swipe or tap'); // no hint on the cover
    expect(errors).toEqual([]);
  });

  test('tapping the cover opens to the first blank page', async ({ page }) => {
    await open(page);
    await page.locator('#book').click();
    await expect(page.locator('.page-count')).toHaveText('new page');
    expect(await letters(page.locator('#book .page.blank .ransom'))).toBe('firstpage');
    await expect(act(page, 'new')).toBeVisible();
  });

  test('swiping flips pages both ways', async ({ page }) => {
    await open(page);
    await addCafe(page);
    await expect(page.locator('.page-count')).toHaveText('page 1 of 1');
    const book = page.locator('#book');
    await drag(page, book, -220, 0);                       // swipe left -> next
    await expect(page.locator('.page-count')).toHaveText('new page');
    await drag(page, book, 220, 0);                        // swipe right -> back
    await expect(page.locator('.page-count')).toHaveText('page 1 of 1');
    await drag(page, book, 30, 260);                       // mostly-vertical drag must not flip
    await expect(page.locator('.page-count')).toHaveText('page 1 of 1');
  });

  test('tapping "+ add a cafe" while the page is still turning is ignored', async ({ page }) => {
    await open(page);
    // the blank page underneath already shows its button mid-flip, and once the turning page has
    // swung past a finger can reach it. Tap it while the turn is in progress (right as it starts,
    // so a slow, busy test machine can't let the turn finish first).
    const tappedMidTurn = await page.evaluate(() => {
      document.querySelector('[data-act="next"]').click();
      const turning = !!document.querySelector('#book .turner');
      document.querySelector('#book [data-act="new"]').click();
      return turning;
    });
    expect(tappedMidTurn).toBe(true);
    await expect(page.locator('#book .turner')).toHaveCount(0);
    await expect(page.locator('.page-count')).toHaveText('new page');
    await expect(act(page, 'save')).toHaveCount(0);            // not stuck editing the cover
    await act(page, 'new').click();                             // once the flip has landed it works
    await expect(page.locator('#book .page.editing')).toBeVisible();
  });

  test('a page turn always lands, even if animation frames stop', async ({ page }) => {
    await open(page);
    // like an app hidden mid-turn: animation frames never arrive
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await act(page, 'next').click();
    await expect(page.locator('.page-count')).toHaveText('new page', { timeout: 3000 });
    await act(page, 'new').click();                             // buttons are not left locked
    await expect(page.locator('#book .page.editing')).toBeVisible();
  });

  test('arrow buttons flip and stop at the ends', async ({ page }) => {
    await open(page);
    await expect(act(page, 'prev')).toBeDisabled();
    await act(page, 'next').click();
    await expect(page.locator('.page-count')).toHaveText('new page');
    await expect(act(page, 'next')).toBeDisabled();
    await act(page, 'prev').click();
    await expect(page.locator('.page-count')).toHaveText('cover');
  });
});

test.describe('cafe pages', () => {
  test('adding a cafe fills every part of the template and is saved', async ({ page }) => {
    await open(page);
    await addCafe(page, { name: 'Hop Cafe', city: 'Arcadia', drink: 'iced matcha', notes: 'cosy corner seat', rating: 4.5, color: 'orange', photos: 2 });
    const leaf = page.locator('#book .page');
    expect(await letters(leaf.locator('.cafe .ransom'))).toBe('hopcafe');
    await expect(leaf.locator('.row.date .hand')).toHaveText('mon · 2 nov 2026');
    await expect(leaf.locator('[data-f="city"]')).toHaveValue('Arcadia');
    await expect(leaf.locator('[data-f="drink"]')).toHaveValue('iced matcha');
    await expect(leaf.locator('[data-f="notes"]')).toHaveValue('cosy corner seat');
    await expect(leaf.locator('.stars')).toHaveAttribute('aria-valuenow', '4.5');
    await expect(leaf.locator('.rating-num')).toHaveText('4.5');
    await expect(leaf.locator('.ph img')).toHaveCount(2);
    await expect(leaf.locator('[data-act="add-photo"]')).toHaveCount(0); // no "+ photo" box once saved

    const { entries } = await stored(page);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ name: 'Hop Cafe', city: 'Arcadia', drink: 'iced matcha', rating: 4.5, starColor: 'orange', date: '2026-11-02' });
    expect(entries[0].photos).toHaveLength(2);
    expect(entries[0].updatedAt).toBeGreaterThan(0);
  });

  test('pages survive closing and reopening the app', async ({ page }) => {
    await open(page);
    await addCafe(page, { name: 'Bean There' });
    await page.reload();
    await expect(page.locator('#book .leaf')).toBeVisible();
    await act(page, 'next').click();
    expect(await letters(page.locator('#book .cafe .ransom'))).toBe('beanthere');
  });

  test('stars rate in half steps, slide, and clear when tapped again', async ({ page }) => {
    await open(page);
    await toBlankPage(page);
    await act(page, 'new').click();
    const stars = page.locator('#book .stars');
    for (const [fx, want] of [[0.03, '0.5'], [0.45, '2.5'], [0.98, '5']]) {
      await tapAt(page, stars, fx);
      // the second tap on 0.5 would clear, so check right after each tap
      await expect(stars).toHaveAttribute('aria-valuenow', want);
    }
    await tapAt(page, stars, 0.98);                          // tap the same rating again -> clears
    await expect(stars).toHaveAttribute('aria-valuenow', '0');
    const b = await stars.boundingBox();                     // slide across
    await page.mouse.move(b.x + 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.7, b.y + b.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(stars).toHaveAttribute('aria-valuenow', '3.5');
  });

  test('only three photos fit, and photos can be removed', async ({ page }) => {
    await open(page);
    await toBlankPage(page);
    await act(page, 'new').click();
    const files = [await photo(page, '#c98f6b', 'a'), await photo(page, '#8fbf6a', 'b'), await photo(page, '#7fa6c9', 'c'), await photo(page, '#f9c6d3', 'd')];
    await page.locator('#photo-input').setInputFiles(files);
    await expect(page.locator('#book .ph img')).toHaveCount(3);
    await expect(act(page, 'add-photo')).toHaveCount(0);
    await page.locator('#book .ph .rm').first().click();
    await expect(page.locator('#book .ph img')).toHaveCount(2);
    await expect(act(page, 'add-photo')).toHaveCount(1);
  });

  test('photos can be resized and tilted, and keep that look when saved', async ({ page }) => {
    await open(page);
    await addCafe(page, { photos: 2 });
    await act(page, 'edit').click();
    await page.locator('#book .ph[data-pi="1"]').click();
    await expect(page.locator('#ph-size')).toBeVisible();
    await setRange(page, '#ph-size', 1.3);
    await setRange(page, '#ph-rot', -12);
    await act(page, 'photo-done').click();
    await save(page);
    const t = await page.locator('#book .ph[data-pi="1"]').evaluate(n => n.style.transform);
    expect(t).toBe('rotate(-12deg) scale(1.3)');
    const { entries } = await stored(page);
    expect(entries[0].photoFx[1]).toEqual({ size: 1.3, rot: -12 });
  });

  test('cancel throws away edits', async ({ page }) => {
    await open(page);
    await addCafe(page, { city: 'Arcadia' });
    await act(page, 'edit').click();
    await page.locator('[data-f="city"]').fill('Pasadena');
    await act(page, 'cancel').click();
    await expect(page.locator('#book [data-f="city"]')).toHaveValue('Arcadia');
    expect((await stored(page)).entries[0].city).toBe('Arcadia');
  });

  test('notes get only as many lines as the writing needs', async ({ page }) => {
    await open(page);
    const lines = () => page.locator('#book .notes textarea').evaluate(t => Math.round(t.clientHeight / parseFloat(getComputedStyle(t).lineHeight)));
    await addCafe(page, { notes: 'cosy corner seat', photos: 0 });
    expect(await lines()).toBe(1);
    await act(page, 'edit').click();
    const notes = page.locator('[data-f="notes"]');
    await notes.fill('a long note that keeps going so it wraps over more than one line, and then some more words to make a third line maybe');
    const typed = await lines();
    expect(typed).toBeGreaterThanOrEqual(3);
    await save(page);
    expect(await lines()).toBe(typed);
    await act(page, 'edit').click();
    await notes.fill('');
    expect(await lines()).toBe(1);             // one line to write on while editing
    await save(page);
    await expect(page.locator('#book .notes')).toBeHidden(); // nothing at all on the saved page
  });

  test('pages are kept in visit-date order', async ({ page }) => {
    await open(page);
    await addCafe(page, { name: 'Later Cafe', date: '2026-10-20', photos: 0 });
    await addCafe(page, { name: 'Early Cafe', date: '2026-03-05', photos: 0 });
    await act(page, 'contents').click();
    await expect(page.locator('#list .item .name')).toHaveText(['Early Cafe', 'Later Cafe']);
  });
});

test.describe('tear out', () => {
  test('asks first; "keep it" keeps the page', async ({ page }) => {
    await open(page);
    await addCafe(page);
    await act(page, 'edit').click();
    await act(page, 'tear').click();
    await expect(page.locator('.ask')).toBeVisible();
    await page.locator('.ask [data-a="no"]').click();
    await expect(page.locator('.ask')).toHaveCount(0);
    expect((await stored(page)).entries).toHaveLength(1);
  });

  test('"tear it out" rips the page out and deletes it', async ({ page }) => {
    await open(page);
    await addCafe(page, { name: 'First' , date: '2026-01-01', photos: 0 });
    await addCafe(page, { name: 'Second', date: '2026-02-01', photos: 0 });
    await expect(page.locator('.page-count')).toHaveText('page 2 of 2'); // saving lands on "Second"
    await act(page, 'prev').click();
    await expect(page.locator('.page-count')).toHaveText('page 1 of 2'); // on "First"
    await expect(page.locator('#book .turner')).toHaveCount(0);          // flip finished
    await act(page, 'edit').click();
    await act(page, 'tear').click();
    await page.locator('.ask [data-a="yes"]').click();
    await expect(page.locator('#book .torn.piece')).toHaveCount(1); // animation is running
    await expect(page.locator('#book .torn')).toHaveCount(0, { timeout: 5000 });
    await expect(page.locator('.page-count')).toHaveText('page 1 of 1');
    expect(await letters(page.locator('#book .cafe .ransom'))).toBe('second');
    expect((await stored(page)).entries.map(e => e.name)).toEqual(['Second']);
  });
});

test.describe('page stickers', () => {
  test('emoji are grouped in tabs: hearts, flowers, sky, food, drinks, animals', async ({ page }) => {
    await open(page);
    await addCafe(page, { photos: 0 });
    await act(page, 'edit').click();
    await act(page, 'page-stickers').click();
    for (const [tab, some, count] of [['food', '🥟', 100], ['drinks', '🧋', 20], ['animals', '🦦', 120], ['hearts', '🩵', 13], ['flowers', '🪷', 15], ['sky', '🫧', 16], ['cute', '🪩', 28]]) {
      await page.locator(`[data-sticker-tab="${tab}"]`).click();
      expect(await page.locator('.sticker-pick button').count()).toBeGreaterThanOrEqual(count);
      await page.locator(`[data-sticker="e:${some}"]`).click();
      await act(page, 'sticker-done').click();
    }
    await act(page, 'stickers-done').click();
    await save(page);
    expect((await stored(page)).entries[0].stickers.map(s => s.k)).toEqual(['e:🥟', 'e:🧋', 'e:🦦', 'e:🩵', 'e:🪷', 'e:🫧', 'e:🪩']);
  });

  test('cute and washi stickers can be added, sized, turned and moved', async ({ page }) => {
    await open(page);
    await addCafe(page);
    await act(page, 'edit').click();
    await act(page, 'page-stickers').click();
    await expect(page.locator('[data-sticker-tab]')).toHaveText(['cute', 'hearts', 'flowers', 'sky', 'food', 'drinks', 'animals', 'washi tape']); // no junk journal tab
    await page.locator('[data-sticker="e:🍓"]').click();
    await setRange(page, '#st-size', 1.8);
    await setRange(page, '#st-rot', 30);
    await act(page, 'sticker-done').click();
    await page.locator('[data-sticker-tab="washi"]').click();
    await page.locator('[data-sticker="w:pink-dots"]').click();
    await act(page, 'sticker-done').click();
    const strawberry = page.locator('#book .sticker').first();
    const before = await relBox(page, '#book .sticker');
    await drag(page, strawberry, 40, 60);
    const after = await relBox(page, '#book .sticker');
    expect(after.y).toBeGreaterThan(before.y + 3);
    await act(page, 'stickers-done').click();
    await save(page);
    await expect(page.locator('#book .sticker')).toHaveCount(2);
    const { entries } = await stored(page);
    expect(entries[0].stickers.map(s => s.k)).toEqual(['e:🍓', 'w:pink-dots']);
    expect(entries[0].stickers[0]).toMatchObject({ size: 1.8, rot: 30 });
  });

  test('where a sticker is placed is exactly where it ends up', async ({ page }) => {
    await open(page);
    await addCafe(page, { photos: 1 });
    await act(page, 'edit').click();
    await act(page, 'page-stickers').click();
    // while placing, only the real photo shows (no "+ photo" box) so the layout matches the saved page
    await expect(page.locator('#book [data-act="add-photo"]')).toHaveCount(0);
    await page.locator('[data-sticker="e:🧁"]').click();
    const placingSticker = await relBox(page, '#book .sticker');
    const placingPhoto = await relBox(page, '#book .ph[data-pi="0"]');
    // the shrunk journal still fits inside its area
    const fits = await page.evaluate(() => {
      const b = document.querySelector('#book').getBoundingClientRect(), s = document.querySelector('#stage').getBoundingClientRect();
      return b.top >= s.top - 1 && b.bottom <= s.bottom + 1 && b.left >= s.left - 1 && b.right <= s.right + 1;
    });
    expect(fits).toBe(true);
    await act(page, 'stickers-done').click();
    await save(page);
    const savedSticker = await relBox(page, '#book .sticker');
    const savedPhoto = await relBox(page, '#book .ph[data-pi="0"]');
    for (const k of ['x', 'y', 'w']) {
      expect(Math.abs(savedSticker[k] - placingSticker[k])).toBeLessThan(0.3);
      expect(Math.abs(savedPhoto[k] - placingPhoto[k])).toBeLessThan(0.3);
    }
  });

  test('stickers don\'t block typing once the drawer is closed', async ({ page }) => {
    await open(page);
    await addCafe(page);
    await act(page, 'edit').click();
    await act(page, 'page-stickers').click();
    await page.locator('[data-sticker-tab="washi"]').click();
    await page.locator('[data-sticker="w:blue-stripe"]').click();
    await act(page, 'stickers-done').click();
    await expect(page.locator('#book .sticker').first()).toHaveCSS('pointer-events', 'none');
    await page.locator('[data-f="notes"]').fill('still typeable');
    await expect(page.locator('[data-f="notes"]')).toHaveValue('still typeable');
  });
});

test.describe('cover', () => {
  test('colour, title and stickers can be changed and are kept', async ({ page }) => {
    await open(page);
    await act(page, 'decorate').click();
    await page.locator('[data-cover-color="blue"]').click();
    await page.locator('#title-in').fill('carol\'s cafes');
    await page.locator('[data-sticker="e:☕"]').click();
    await setRange(page, '#st-size', 2);
    await act(page, 'decor-done').click();
    expect(await letters(page.locator('.cover-title'))).toBe('carol\'scafes');
    await page.reload();
    await expect(page.locator('#book .leaf.cover')).toBeVisible();
    await expect(page.locator('.cover')).toHaveAttribute('style', /bcdcf5/);
    expect(await letters(page.locator('.cover-title'))).toBe('carol\'scafes');
    const { cover } = await stored(page);
    expect(cover.stickers).toHaveLength(1);
    expect(cover.stickers[0]).toMatchObject({ k: 'e:☕', size: 2 });
  });

  test('a title letter can be given its own paper, ink, font and case', async ({ page }) => {
    await open(page);
    await act(page, 'decorate').click();
    await page.locator('.cover-title .rl[data-li="0"]').click();
    await expect(page.locator('[data-letter-bg]')).toHaveCount(6);
    await page.locator('[data-letter-bg="green"]').click();
    await page.locator('[data-letter-fg="pink"]').click();
    await page.locator('[data-letter-font="2"]').click();
    await page.locator('[data-letter-upper="1"]').click();
    const l = page.locator('.cover-title .rl[data-li="0"]');
    await expect(l).toHaveText('C');
    await expect(l).toHaveAttribute('style', /background:#c5e6c8;color:#f9c6d3;font-family:'Bungee'/);
    await act(page, 'letter-reset').click();
    await expect(l).not.toHaveAttribute('style', /background:#c5e6c8;color:#f9c6d3;font-family:'Bungee'/);
  });

  test('the cover photo can be added, moved, resized and turned', async ({ page }) => {
    await open(page);
    await act(page, 'decorate').click();
    await page.locator('#cover-photo-input').setInputFiles(await photo(page, '#d6b58a', 'us'));
    const cp = page.locator('.cover-photo');
    await expect(cp).toBeVisible();
    // it is a polaroid, not a tall strip
    const box = await cp.boundingBox();
    expect(box.height / box.width).toBeLessThan(1.3);
    await drag(page, cp, -40, 50);
    await expect(page.locator('#cp-size')).toBeVisible();     // pressing it also selected it
    await setRange(page, '#cp-size', 0.8);
    await setRange(page, '#cp-rot', 15);
    const { cover } = await stored(page);
    expect(cover.photoFx.size).toBe(0.8);
    expect(cover.photoFx.rot).toBe(15);
    expect(cover.photoFx.x).toBeLessThan(48);
    expect(cover.photoFx.y).toBeGreaterThan(58);
  });
});

test.describe('contents, search and backup', () => {
  test('search finds cafes by name, city or drink and jumps to the page', async ({ page }) => {
    await open(page);
    await addCafe(page, { name: 'Hop Cafe', city: 'Arcadia', drink: 'matcha', date: '2026-01-01', photos: 0 });
    await addCafe(page, { name: 'Lisa\'s Beans', city: 'Pasadena', drink: 'cortado', date: '2026-02-01', photos: 0 });
    await act(page, 'contents').click();
    await page.locator('#search').fill('pasa');
    await expect(page.locator('#list .item')).toHaveCount(1);
    await page.locator('#search').fill('matcha');
    await expect(page.locator('#list .item .name')).toHaveText(['Hop Cafe']);
    await page.locator('#search').fill('zzz');
    await expect(page.locator('#list .none')).toHaveText('no cafes match that search');
    await page.locator('#search').fill('lisa');
    await page.locator('#list .item').click();
    await expect(page.locator('#contents')).toBeHidden();
    await expect(page.locator('.page-count')).toHaveText('page 2 of 2');
  });

  test('a backup can be saved and restored', async ({ page }) => {
    await open(page);
    await addCafe(page, { name: 'Backup Cafe' });
    await act(page, 'contents').click();
    const [download] = await Promise.all([page.waitForEvent('download'), act(page, 'export').click()]);
    expect(download.suggestedFilename()).toMatch(/^cafe-log-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const file = await download.path();
    const data = JSON.parse(require('fs').readFileSync(file, 'utf8'));
    expect(data.app).toBe('cafe-log');
    expect(data.entries[0].name).toBe('Backup Cafe');
    // wipe the page, then restore it from the file
    await act(page, 'close-contents').click();
    await act(page, 'edit').click();
    await act(page, 'tear').click();
    await page.locator('.ask [data-a="yes"]').click();
    await expect(page.locator('#book .torn')).toHaveCount(0, { timeout: 5000 });
    expect((await stored(page)).entries).toHaveLength(0);
    await act(page, 'contents').click();
    await page.locator('#import-input').setInputFiles(file);
    await expect(page.locator('#list .item .name')).toHaveText(['Backup Cafe']);
    expect((await stored(page)).entries).toHaveLength(1);
  });
});

test.describe('fits the device', () => {
  test('nothing spills off the screen and buttons are easy to tap', async ({ page }) => {
    await open(page);
    await addCafe(page);
    for (const state of ['read', 'edit', 'stickers', 'decorate', 'contents']) {
      if (state === 'edit') await act(page, 'edit').click();
      if (state === 'stickers') await act(page, 'page-stickers').click();
      if (state === 'decorate') { await act(page, 'cancel').click(); await page.locator('[data-act="prev"]').click(); await act(page, 'decorate').click(); }
      if (state === 'contents') { await act(page, 'decor-done').click(); await act(page, 'contents').click(); }
      const r = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth, vh = window.innerHeight;
        const offscreen = [...document.querySelectorAll('button, input, textarea')]
          .filter(el => el.offsetParent && !el.closest('#book') && !el.closest('.sticker-pick'))
          .filter(el => { const b = el.getBoundingClientRect(); return b.width && (b.right > vw + 1 || b.left < -1 || b.bottom > vh + 1); })
          .map(el => el.dataset.act || el.id || el.className);
        const small = [...document.querySelectorAll('#topbar .btn, #pager .btn')]
          .filter(el => { const b = el.getBoundingClientRect(); return b.height < 26; }).map(el => el.dataset.act);
        return { scrollX: document.documentElement.scrollWidth > vw, offscreen, small };
      });
      expect(r, `state: ${state}`).toEqual({ scrollX: false, offscreen: [], small: [] });
    }
  });

  test('text boxes are 16px or bigger, so iPhone/iPad Safari does not zoom in', async ({ page }) => {
    await open(page);
    await toBlankPage(page);
    await act(page, 'new').click();
    const sizes = await page.evaluate(() => [...document.querySelectorAll('#book input:not([type=file]), #book textarea, #search, #title-in')]
      .filter(el => el.offsetParent).map(el => [el.dataset.f || el.id, parseFloat(getComputedStyle(el).fontSize)]));
    for (const [name, px] of sizes) expect(px, name).toBeGreaterThanOrEqual(16);
  });

  test('the page-flip sound setting is remembered', async ({ page }) => {
    await open(page);
    await act(page, 'sound').click();
    await expect(act(page, 'sound')).toHaveText('×');
    await page.reload();
    await expect(act(page, 'sound')).toHaveText('×');
  });
});

test.describe('installable app', () => {
  test('manifest and icons are valid', async ({ page, request }) => {
    await open(page);
    const m = await (await request.get('/manifest.webmanifest')).json();
    expect(m).toMatchObject({ name: 'Cafe Log', display: 'standalone', start_url: './' });
    for (const icon of [...m.icons, { src: 'icons/icon-180.png', sizes: '180x180' }]) {
      const res = await request.get('/' + icon.src);
      expect(res.status(), icon.src).toBe(200);
      const png = await res.body();
      const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
      expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
    }
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', 'icons/icon-180.png');
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  });

  test('works offline after the first visit', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Playwright\'s Windows WebKit build has no service workers; checked in Chrome');
    await open(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();                                       // second load is served through the worker
    await expect(page.locator('#book .leaf')).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#book .leaf.cover')).toBeVisible();
    await context.setOffline(false);
  });
});
