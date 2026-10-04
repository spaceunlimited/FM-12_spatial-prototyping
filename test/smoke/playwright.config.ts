import { defineConfig } from '@playwright/test';

// Headless Chromium has no GPU: force the software renderer so WebGL exists at all.
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  retries: 0,
  reporter: 'list',
  outputDir: '../../test-results',
  use: {
    baseURL: process.env.SMOKE_URL || 'http://localhost:5173',
    headless: true,
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
});
