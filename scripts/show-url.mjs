#!/usr/bin/env node
// Prints the current dev URLs and QR code again.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

if (!existsSync('.dev-url')) {
  console.log('The dev server is not running. Start it with:  npm run dev');
  process.exit(1);
}
const info = JSON.parse(readFileSync('.dev-url', 'utf8'));
const qr = require('qrcode-terminal');
qr.generate(info.url, { small: true }, (code) => {
  console.log(code);
  console.log(`Experience   ${info.url}`);
  console.log(`Device setup ${info.setup}`);
  console.log(`Device check ${info.check}`);
  if (info.certHttp) console.log(`Certificate  ${info.certHttp}`);
  console.log(`Started      ${info.startedAt}`);
});
