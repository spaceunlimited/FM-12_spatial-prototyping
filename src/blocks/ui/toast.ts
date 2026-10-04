/**
 * @block toast
 * A short notice that fades after a moment: an HTML strip at the bottom on phones and the
 * laptop, a lazy-following panel inside a headset session (no HTML there).
 * @option text string
 * @option ms number = 3500 — how long it stays
 */
import { hasRuntime, getRuntime } from '../../runtime/state';
import { Panel } from './Panel';

let el: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let scenePanel: Panel | null = null;

export function toast(text: string, ms = 3500) {
  const inScene = hasRuntime() && getRuntime().profile.immersive && !getRuntime().profile.hasDomOverlay;
  if (inScene) {
    const { ctx } = getRuntime();
    if (!scenePanel) {
      scenePanel = new Panel({ text, width: 0.5, follow: 'lazy', distance: 1.2 });
      ctx.scene.add(scenePanel);
    } else scenePanel.setText(text);
    scenePanel.visible = true;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => scenePanel && (scenePanel.visible = false), ms);
    return;
  }
  const overlay = document.getElementById('overlay');
  if (!overlay) return;
  if (!el) {
    el = document.createElement('div');
    el.className = 'mr-toast';
    overlay.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => el?.classList.remove('show'), ms);
}
