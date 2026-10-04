// Finds the local root certificate so the setup page can offer it for download.
// scripts/cert.mjs creates it in ~/.xr-sandbox/cert (shared by every sandbox on this laptop).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const CERT_HOME = join(homedir(), '.xr-sandbox', 'cert');
export const ROOT_CA_PATH = join(CERT_HOME, 'rootCA.pem');

export function readRootCA(): Buffer | null {
  try {
    return existsSync(ROOT_CA_PATH) ? readFileSync(ROOT_CA_PATH) : null;
  } catch {
    return null;
  }
}
