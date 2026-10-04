// Writes a picture of the scene as the laptop preview and the phone view render it, so a person
// (or Claude) can look at it before anyone picks up a device. A pre-check, not a test: it only
// fails when the page does not boot. Both use the phone-camera profile over the studio panorama;
// the headset emulator is left out on purpose, its gizmos and panels obscure more than they show.
//
//   npm run screenshot        → test-results/scene-desktop.png, test-results/scene-phone.png
import { test } from '@playwright/test';

const OUT = 'test-results';

for (const [name, viewport] of [
  ['desktop', { width: 1280, height: 800 }],
  ['phone', { width: 430, height: 932 }],
] as const) {
  test(`screenshot of the ${name} view`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?sim=phone&autostart=1');
    await page.waitForFunction(() => (window as any).__sandbox?.ready === true, null, { timeout: 30_000 });
    // Appear animations and the first typewriter lines need a moment to settle.
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/scene-${name}.png` });
  });
}
