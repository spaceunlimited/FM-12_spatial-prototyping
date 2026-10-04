import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.goto(process.argv[2]);
await page.waitForFunction(() => window.__sandbox?.ready === true, null, { timeout: 40000 });
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(700);
  console.log(JSON.stringify(await page.evaluate(() => {
    const s = window.__sandbox; const T = s.scene.position.constructor;
    const eye = s.camera.getWorldPosition(new T()).toArray().map(n=>+n.toFixed(2));
    const dir = s.camera.getWorldDirection(new T()).toArray().map(n=>+n.toFixed(2));
    const vs = s.profile.viewerSurface?.(); const hs = s.profile.hitSurface(null);
    return { eye, dir, viewerSurface: vs ? vs.toArray().map(n=>+n.toFixed(2)) : null, handSurface: hs ? hs.toArray().map(n=>+n.toFixed(2)) : null, placed: s.scene.getObjectByName('placed')?.userData.placed?.used, headPos: s.xrDevice.position.toArray?.() ?? [s.xrDevice.position.x, s.xrDevice.position.y, s.xrDevice.position.z] };
  })));
}
await browser.close();
