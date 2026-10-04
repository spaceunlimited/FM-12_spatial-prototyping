import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
await page.goto(process.argv[2]);
await page.waitForFunction(() => window.__sandbox?.ready === true, null, { timeout: 40000 });
const mode = process.argv[3] || 'plain';
await page.evaluate((mode) => {
  const d = window.__sandbox.xrDevice; const V = d.position.constructor;
  if (mode === 'programmatic') d.controlMode = 'programmatic';
  d.quaternion.setFromAxisAngle(new V(1, 0, 0), -0.7);
  if (mode === 'notify') d.notifyStateChange();
}, mode);
for (let i = 0; i < 4; i++) {
  await page.waitForTimeout(600);
  console.log(mode, JSON.stringify(await page.evaluate(() => {
    const s = window.__sandbox; const T = s.scene.position.constructor; const d = s.xrDevice;
    const dir = s.camera.getWorldDirection(new T()).toArray().map(n=>+n.toFixed(2));
    const vs = s.profile.viewerSurface?.();
    return { dir, q: [d.quaternion.x, d.quaternion.y, d.quaternion.z, d.quaternion.w].map(n=>+n.toFixed(2)), controlMode: d.controlMode, viewerSurface: vs ? vs.toArray().map(n=>+n.toFixed(2)) : null, placed: s.scene.getObjectByName('placed')?.userData.placed?.used };
  })));
}
await browser.close();
