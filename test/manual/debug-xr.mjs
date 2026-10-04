import { chromium } from '@playwright/test';
const url = process.argv[2];
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)));
page.on('console', (m) => { if (m.type()==='error') console.log('[console.error]', m.text().slice(0,300)); });
await page.goto(url);
const t0 = Date.now();
await page.waitForFunction(() => window.__sandbox?.ready === true, null, { timeout: 40000 });
console.log('ready after', Date.now() - t0, 'ms');
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const s = window.__sandbox; const d = s.xrDevice; const sess = s.renderer.xr.getSession();
  const ref = s.renderer.xr.getReferenceSpace();
  return {
    profile: s.profile.id, caps: s.profile.capabilities,
    inputSources: Array.from(sess?.inputSources || []).map(i => ({ mode: i.targetRayMode, hand: i.handedness, grip: !!i.gripSpace, xrhand: !!i.hand })),
    controllers: Object.fromEntries(Object.entries(d.controllers).map(([k,v]) => [k, v?.connected])),
    hands: Object.fromEntries(Object.entries(d.hands).map(([k,v]) => [k, v?.connected])),
    primaryInputMode: d.primaryInputMode,
    spaces: Object.fromEntries(Object.entries(s.profile.debugRaySpaces()).map(([k,v]) => [k, { tracked: v.tracked, pos: v.position.toArray().map(n=>+n.toFixed(2)) }])),
    tracked: s.profile.trackedPointerCount(),
    refSpace: !!ref,
  };
});
console.log(JSON.stringify(info, null, 1));
// probe a frame pose directly
const pose = await page.evaluate(() => new Promise((res) => {
  const s = window.__sandbox; const sess = s.renderer.xr.getSession(); const ref = s.renderer.xr.getReferenceSpace();
  sess.requestAnimationFrame((t, frame) => {
    const out = [];
    for (const src of sess.inputSources) { const p = frame.getPose(src.targetRaySpace, ref); out.push({ hand: src.handedness, pose: !!p, emulated: p?.emulatedPosition, pos: p ? [p.transform.position.x, p.transform.position.y, p.transform.position.z].map(n=>+n.toFixed(2)) : null }); }
    res(out);
  });
}));
console.log('frame poses', JSON.stringify(pose));
await browser.close();
