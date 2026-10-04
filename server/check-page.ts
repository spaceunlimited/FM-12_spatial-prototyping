// /check — the device runs this page, it probes what the browser can do and posts the result
// to /api/diag so it can be read from the laptop (curl -sk https://localhost:5173/api/diag).
export function checkPage(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Device check</title>
<style>
  body{font:16px/1.5 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;margin:0;padding:20px;background:#fafafa;color:#111}
  main{max-width:560px;margin:auto} h1{font-size:22px;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;font-size:15px} td{padding:8px 6px;border-bottom:1px solid #e5e5e5;vertical-align:top} td:first-child{color:#555;width:52%}
  .ok{color:#1a7f37;font-weight:600}.no{color:#b42318;font-weight:600}.meh{color:#9a6700;font-weight:600}
  button{font:inherit;padding:12px 16px;border-radius:10px;border:0;background:#111;color:#fff;margin:6px 6px 6px 0}
  .note{font-size:14px;color:#555;margin-top:16px}
</style></head><body><main>
<h1>Device check</h1>
<table id="t"></table>
<p><button id="cam">Test camera permission</button><button id="motion">Test motion permission</button><button id="ar">Test AR session</button><button id="send">Send results to laptop</button></p>
<p class="note" id="sent"></p>
<p class="note">Green means the feature is available on this device and browser. Yellow means it may work with limits. Red means design around it: fake mode and on-screen prompts cover most of it.</p>
<script>
const r = {};
const ua = navigator.userAgent;
r.device = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /OculusBrowser/.test(ua) ? 'Meta Quest' : /Android/.test(ua) ? 'Android' : 'Laptop';
r.browser = ua.slice(0, 120);
r.secureContext = window.isSecureContext;
r.screen = screen.width + '×' + screen.height + ' @' + (window.devicePixelRatio||1);
r.getUserMedia = !!navigator.mediaDevices?.getUserMedia;
r.deviceOrientation = 'DeviceOrientationEvent' in window;
r.orientationNeedsPermission = typeof DeviceOrientationEvent?.requestPermission === 'function';
r.webxr = !!navigator.xr;
r.speechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
r.speechSynthesis = !!window.speechSynthesis;
r.voices = window.speechSynthesis ? speechSynthesis.getVoices().length : 0;
r.webgl2 = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
r.immersiveAR = 'checking…'; r.immersiveVR = 'checking…';

function row(k, v){ const cls = v===true||v==='yes'?'ok':(v===false||v==='no')?'no':(typeof v==='string'&&/limit|maybe|unknown/.test(v))?'meh':''; return '<tr><td>'+k+'</td><td class="'+cls+'">'+String(v)+'</td></tr>'; }
function render(){ document.getElementById('t').innerHTML = Object.entries(r).map(([k,v])=>row(k,v)).join(''); }
render();

(async () => {
  if (navigator.xr) {
    r.immersiveAR = await navigator.xr.isSessionSupported('immersive-ar').catch(()=>false);
    r.immersiveVR = await navigator.xr.isSessionSupported('immersive-vr').catch(()=>false);
  } else { r.immersiveAR = false; r.immersiveVR = false; }
  render();
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { r.voices = speechSynthesis.getVoices().length; render(); };
})();

document.getElementById('cam').onclick = async () => {
  try { const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); r.cameraPermission = true; s.getTracks().forEach(t=>t.stop()); }
  catch(e){ r.cameraPermission = 'no: ' + e.name; } render();
};
document.getElementById('motion').onclick = async () => {
  try {
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') { r.motionPermission = await DeviceOrientationEvent.requestPermission(); }
    else r.motionPermission = 'no prompt needed';
    let got=false; window.addEventListener('deviceorientation', e => { if(!got && e.alpha!=null){ got=true; r.orientationEvents = true; render(); } }, {once:false});
    setTimeout(()=>{ if(!got){ r.orientationEvents = 'no events (laptop?)'; render(); } }, 1500);
  } catch(e){ r.motionPermission = 'no: ' + e.name; } render();
};
// Which AR features the device actually grants, and what it gives us to point with. Only a real
// session can answer this, so it needs a tap. Ends itself after a few seconds.
document.getElementById('ar').onclick = async () => {
  if (!navigator.xr) { r.arSession = 'no WebXR'; render(); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: [],
      optionalFeatures: ['local-floor','hit-test','hand-tracking','anchors','dom-overlay'],
      domOverlay: { root: document.body },
    });
    r.arSession = 'started';
    r.arFeatures = (session.enabledFeatures || ['(not reported)']).join(', ');
    r.arDomOverlay = !!session.domOverlayState;
    r.arFloor = await session.requestReferenceSpace('local-floor').then(()=>true).catch(()=>false);
    const seen = new Set();
    const note = () => { for (const s of session.inputSources) seen.add((s.hand ? 'hand' : s.targetRayMode) + ':' + s.handedness); };
    note();
    session.addEventListener('inputsourceschange', note);
    session.addEventListener('select', () => { r.arSelect = true; render(); });
    await new Promise(res => setTimeout(res, 4000));
    note();
    r.arPointers = [...seen].join(', ') || 'none seen — hold your hands up and try again';
    await session.end().catch(()=>{});
    render();
  } catch(e) { r.arSession = 'no: ' + e.name + ' — ' + e.message; render(); }
};
document.getElementById('send').onclick = async () => {
  await fetch('/api/diag', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(r)});
  document.getElementById('sent').textContent = 'Sent. On the laptop: curl -sk https://localhost:5173/api/diag';
};
</script></main></body></html>`;
}
