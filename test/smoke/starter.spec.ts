// Does the starter scene do what README promises? Only the standalone check runs this; the
// benchmark must not, because Claude will have changed the scene by then.
import { test, expect } from '@playwright/test';

test('starter: a draggable cube, a label, a panel and a fake AI reply', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?sim=phone&autostart=1');
  await page.waitForFunction(() => (window as any).__sandbox?.ready === true, null, { timeout: 30_000 });
  await page.waitForTimeout(600); // appear animations

  const names = await page.evaluate(() => (window as any).__sandbox.stage.children.map((c: any) => c.name));
  expect(names).toContain('cube');
  expect(names).toContain('Panel');
  expect(names).toContain('Label');
  const placed = await page.evaluate(() => (window as any).__sandbox.scene.getObjectByName('placed')?.userData.placed);
  expect(placed?.used).toBe('front'); // no surfaces in the phone view

  // Where is the cube on screen?
  const pt = await page.evaluate(() => {
    const s = (window as any).__sandbox;
    const cube = s.stage.children.find((c: any) => c.name === 'cube');
    const v = cube.getWorldPosition(new (cube.position.constructor)());
    v.project(s.camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  });
  const before = await page.evaluate(() => (window as any).__sandbox.stage.children.find((c: any) => c.name === 'Panel').text);

  // Tap → fake AI reply (600–1200 ms of "thinking", then typewriter).
  await page.mouse.click(pt.x, pt.y);
  await page.waitForFunction(
    (b) => {
      const p = (window as any).__sandbox.stage.children.find((c: any) => c.name === 'Panel');
      return p.text !== b && p.text !== '…';
    },
    before,
    { timeout: 5000 },
  );
  const after = await page.evaluate(() => (window as any).__sandbox.stage.children.find((c: any) => c.name === 'Panel').text);
  expect(after).toMatch(/fake AI|Hello again/);

  // Drag → the cube moved.
  const p0 = await page.evaluate(() => (window as any).__sandbox.stage.children.find((c: any) => c.name === 'cube').position.toArray());
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(pt.x + i * 12, pt.y + i * 4);
  await page.mouse.up();
  const p1 = await page.evaluate(() => (window as any).__sandbox.stage.children.find((c: any) => c.name === 'cube').position.toArray());
  expect(Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2])).toBeGreaterThan(0.02);

  expect(errors).toEqual([]);
});

test('starter in the headset emulator: controller trigger selects the cube', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?sim=headset&autostart=1');
  await page.waitForFunction(() => (window as any).__sandbox?.ready === true, null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).__sandbox.profile.id)).toBe('headset-webxr');
  // The emulated session needs a few frames before the controllers report poses.
  await page.waitForFunction(() => (window as any).__sandbox.profile.trackedPointerCount() > 0, null, { timeout: 10_000 });
  await page.waitForTimeout(500);

  // Put the cube 0.8 m along the right controller's ray, then pull the trigger.
  const before = await page.evaluate(() => {
    const s = (window as any).__sandbox;
    const T = s.scene.position.constructor; // THREE.Vector3
    const space = s.profile.debugRaySpaces().right;
    const origin = space.getWorldPosition(new T());
    const dir = space.getWorldDirection(new T()).negate();
    const target = origin.clone().addScaledVector(dir, 0.8);
    const cube = s.stage.children.find((c: any) => c.name === 'cube');
    cube.position.copy(s.stage.worldToLocal(target));
    cube.updateMatrixWorld(true);
    return s.stage.children.find((c: any) => c.name === 'Panel').text;
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as any).__sandbox.xrDevice.controllers.right.updateButtonValue('trigger', 1));
  await page.waitForTimeout(150);
  await page.evaluate(() => (window as any).__sandbox.xrDevice.controllers.right.updateButtonValue('trigger', 0));
  await page.waitForFunction(
    (b) => {
      const p = (window as any).__sandbox.stage.children.find((c: any) => c.name === 'Panel');
      return p.text !== b && p.text !== '…';
    },
    before,
    { timeout: 5000 },
  );
  expect(errors).toEqual([]);
});

test('headset emulator: hands pinch-select, and place() finds a surface in the synthetic room', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?sim=headset&autostart=1');
  await page.waitForFunction(() => (window as any).__sandbox?.ready === true, null, { timeout: 30_000 });
  // Look down at the floor like a person would; the emulator stares straight at a wall otherwise,
  // and a wall is never "the table" (place() rejects hits at or above eye height).
  await page.evaluate(() => {
    const d = (window as any).__sandbox.xrDevice;
    const V = d.position.constructor;
    d.controlMode = 'programmatic'; // otherwise the dev UI reapplies its own pose every frame
    d.quaternion.setFromAxisAngle(new V(1, 0, 0), -0.7);
  });
  await page.evaluate(() => ((window as any).__sandbox.xrDevice.primaryInputMode = 'hand'));
  await page.waitForFunction(() => (window as any).__sandbox.profile.capabilities.hands === true, null, { timeout: 10_000 });
  await page.waitForFunction(() => (window as any).__sandbox.profile.trackedPointerCount() > 0, null, { timeout: 10_000 });
  await page.waitForTimeout(500);

  // The placed object settled on a surface of the emulated room (or fell back after 6 s).
  await page.waitForFunction(() => !!(window as any).__sandbox.scene.getObjectByName('placed')?.userData.placed, null, { timeout: 8000 });
  const placed = await page.evaluate(() => (window as any).__sandbox.scene.getObjectByName('placed').userData.placed);
  expect(placed.used).toBe('surface');

  const before = await page.evaluate(() => {
    const s = (window as any).__sandbox;
    const T = s.scene.position.constructor;
    const space = s.profile.debugRaySpaces().right;
    const origin = space.getWorldPosition(new T());
    const dir = space.getWorldDirection(new T()).negate();
    const cube = s.stage.children.find((c: any) => c.name === 'cube');
    cube.position.copy(s.stage.worldToLocal(origin.clone().addScaledVector(dir, 0.8)));
    cube.updateMatrixWorld(true);
    return s.stage.children.find((c: any) => c.name === 'Panel').text;
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as any).__sandbox.xrDevice.hands.right.updatePinchValue(1));
  await page.waitForTimeout(150);
  await page.evaluate(() => (window as any).__sandbox.xrDevice.hands.right.updatePinchValue(0));
  await page.waitForFunction(
    (b) => {
      const p = (window as any).__sandbox.stage.children.find((c: any) => c.name === 'Panel');
      return p.text !== b && p.text !== '…';
    },
    before,
    { timeout: 5000 },
  );
  expect(errors).toEqual([]);
});

test('AR phone emulator boots the phone-webxr profile with surfaces', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?sim=phone-ar&autostart=1');
  await page.waitForFunction(() => (window as any).__sandbox?.ready === true, null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).__sandbox.profile.id)).toBe('phone-webxr');
  expect(await page.evaluate(() => (window as any).__sandbox.profile.capabilities.surfaceHitTest)).toBe(true);
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});
