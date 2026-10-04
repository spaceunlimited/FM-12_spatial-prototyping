// Does the sandbox boot at all? Used by the benchmark after Claude changed the experience, so it
// must not depend on what the starter scene contains.
import { test, expect } from '@playwright/test';

test('the page boots in the phone preview without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?sim=phone&autostart=1');
  await page.waitForFunction(() => (window as any).__sandbox?.ready === true, null, { timeout: 30_000 });
  // Let a few frames render so late errors surface.
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('the page boots in the headset emulator without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?sim=headset&autostart=1');
  await page.waitForFunction(() => (window as any).__sandbox?.ready === true, null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).__sandbox.profile.id)).toBe('headset-webxr');
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});

test('the proxy answers without a key', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  const h = await health.json();
  expect(h.ok).toBe(true);
  expect(typeof h.keyPresent).toBe('boolean');
  const text = await request.post('/api/text', { data: { messages: [{ role: 'user', text: 'hi' }] } });
  const t = await text.json();
  if (!h.keyPresent) expect(t.fallback).toBe(true);
  expect(typeof t.text).toBe('string');
});
