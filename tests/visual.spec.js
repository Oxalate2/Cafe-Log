// Screenshot tests: each key screen is compared with a saved reference picture in tests/screens/<device>/.
// After an intended change to the look, re-take them with:  npm run test:update-screens
const { test } = require('@playwright/test');
const { open, act, toBlankPage, addCafe, expect } = require('./helpers');

const shot = (page, name) => expect(page).toHaveScreenshot(`${name}.png`, { fullPage: false });

test.describe('screens', () => {
  test('cover', async ({ page }) => {
    await open(page);
    await shot(page, '01-cover');
  });

  test('first blank page', async ({ page }) => {
    await open(page);
    await toBlankPage(page);
    await shot(page, '02-first-page');
  });

  test('cafe page', async ({ page }) => {
    await open(page);
    await addCafe(page, { photos: 2 });
    await shot(page, '03-cafe-page');
  });

  test('editing a page', async ({ page }) => {
    await open(page);
    await addCafe(page, { photos: 1 });
    await act(page, 'edit').click();
    await page.locator('#book [data-f="notes"]').blur();
    await shot(page, '04-editing');
  });

  test('photo size & turn', async ({ page }) => {
    await open(page);
    await addCafe(page, { photos: 2 });
    await act(page, 'edit').click();
    await page.locator('#book .ph[data-pi="0"]').click();
    await shot(page, '05-photo-controls');
  });

  test('sticker drawer', async ({ page }) => {
    await open(page);
    await addCafe(page, { photos: 1 });
    await act(page, 'edit').click();
    await act(page, 'page-stickers').click();
    await page.locator('[data-sticker="e:🧁"]').click();
    await act(page, 'sticker-done').click();
    await page.locator('[data-sticker-tab="washi"]').click();
    await page.locator('[data-sticker="w:pink-dots"]').click();
    await shot(page, '06-sticker-drawer');
  });

  test('decorating the cover', async ({ page }) => {
    await open(page);
    await act(page, 'decorate').click();
    await page.locator('[data-sticker-tab="flowers"]').click();
    await page.locator('[data-sticker="e:🌸"]').click();
    await act(page, 'sticker-done').click();
    await shot(page, '07-decorate');
    await page.locator('.cover-title .rl[data-li="2"]').click();
    await shot(page, '08-letter-style');
  });

  test('contents', async ({ page }) => {
    await open(page);
    await addCafe(page, { name: 'Hop Cafe', date: '2026-03-02' });
    await addCafe(page, { name: 'Lisa\'s Beans', city: 'Pasadena', drink: 'cortado', rating: 3, date: '2026-05-14', photos: 0 });
    await act(page, 'contents').click();
    await page.locator('#search').blur();
    await shot(page, '09-contents');
  });

  test('tear out question', async ({ page }) => {
    await open(page);
    await addCafe(page, { photos: 1 });
    await act(page, 'edit').click();
    await act(page, 'tear').click();
    await shot(page, '10-tear-out');
  });
});
