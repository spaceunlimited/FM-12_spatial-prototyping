// The first page a student opens on a new device. Detects the OS and shows only
// that device's steps for trusting the certificate and opening the experience.
export function setupPage(ua: string, env: Record<string, string>): string {
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isQuest = /OculusBrowser|Quest/.test(ua);
  const isAndroid = /Android/.test(ua) && !isQuest;
  const certPort = env.CERT_HTTP_PORT || '5174';
  const device = isIOS ? 'iphone' : isQuest ? 'quest' : isAndroid ? 'android' : 'laptop';

  const steps: Record<string, string> = {
    iphone: `
      <h2>iPhone · one-time setup</h2>
      <ol>
        <li>Tap <b>Download certificate</b> below. Safari asks to allow a configuration profile. Allow it.</li>
        <li>Open <b>Settings</b>. At the top, tap <b>Profile Downloaded</b> → <b>Install</b> (enter your passcode).</li>
        <li>Then <b>Settings → General → About → Certificate Trust Settings</b> and switch on the one starting with <b>mkcert</b>.</li>
        <li>Come back to Safari and reload this page. The padlock should be closed now.</li>
        <li>Tap <b>Open the experience</b>. Allow camera and motion access when asked.</li>
      </ol>
      <p class="note">If the download link does not work over https yet, open the plain-http version on the same Wi-Fi:<br><code id="httpurl"></code></p>`,
    android: `
      <h2>Android · one-time setup</h2>
      <ol>
        <li>Tap <b>Download certificate</b> below.</li>
        <li>Open <b>Settings → Security (or Privacy) → More security settings → Encryption &amp; credentials → Install a certificate → CA certificate</b>. Choose <b>Install anyway</b> and pick the downloaded file.</li>
        <li>Reload this page in Chrome. The padlock should be closed now.</li>
        <li>Tap <b>Open the experience</b>. Allow camera access when asked.</li>
      </ol>
      <p class="note">Surfaces (objects that stick to the table) need Google Play Services for AR. Chrome asks to install it the first time if your phone supports it.</p>`,
    quest: `
      <h2>Meta Quest · setup</h2>
      <p>Quest cannot trust a laptop certificate the way phones can. Use one of these:</p>
      <ol>
        <li><b>Cable (recommended):</b> enable Developer Mode in the Meta Horizon app, connect USB, and on the laptop run <code>npm run dev -- --quest</code>. Then open <code>http://localhost:5173</code> in the Quest browser.</li>
        <li><b>No cable:</b> if you already see this page, you clicked through the certificate warning. Tap <b>Open the experience</b> — the page recognises the headset by itself and offers <b>Enter the room</b>. There is no special link and nothing to type.</li>
        <li><b>Last resort:</b> on the laptop run <code>npm run dev -- --tunnel</code> and open the public link it prints.</li>
      </ol>`,
    laptop: `
      <h2>Laptop · preview</h2>
      <p>You are on the laptop. The experience runs here in a simulator (mouse drag to look around, click to tap). To test on a device, scan the QR code in the terminal with your phone.</p>
      <p>Open this page on the phone to see that device's setup steps.</p>`,
  };

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Device setup</title>
<style>
  body{font:17px/1.5 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;margin:0;padding:24px;background:#fafafa;color:#111}
  main{max-width:560px;margin:auto}
  h1{font-size:22px;margin:0 0 4px}h2{font-size:19px;margin:24px 0 8px}
  ol{padding-left:22px}li{margin:8px 0}
  .btn{display:block;text-align:center;padding:16px;border-radius:12px;background:#111;color:#fff;text-decoration:none;font-weight:600;margin:12px 0}
  .btn.secondary{background:#e8e8e8;color:#111}
  .status{padding:12px 14px;border-radius:10px;background:#eef;margin:12px 0}
  .ok{background:#e6f7ea}.bad{background:#fdecec}
  .note{font-size:15px;color:#555}code{background:#eee;padding:2px 6px;border-radius:6px;font-size:14px}
</style></head><body><main>
<h1>Device setup</h1>
<div id="secure" class="status">Checking connection…</div>
<div id="willrun" class="status">Checking what this device can do…</div>
${steps[device]}
${device !== 'laptop' && device !== 'quest' ? '<a class="btn secondary" href="/cert/rootCA.crt">Download certificate</a>' : ''}
<a class="btn" href="/">Open the experience</a>
<a class="btn secondary" href="/check">Run the device check</a>
<script>
  var s=document.getElementById('secure');
  if(window.isSecureContext){s.textContent='Secure connection ✓ — camera and AR are allowed on this page.';s.className='status ok';}
  else{s.textContent='Not a secure connection yet. Finish the certificate steps, then reload.';s.className='status bad';}
  var h=document.getElementById('httpurl'); if(h){h.textContent='http://'+location.hostname+':${certPort}/cert/';}
  // The same detection the experience itself does, so this page can promise what will happen.
  (async function(){
    var w=document.getElementById('willrun');
    try{
      if(!navigator.xr){ w.textContent='This device has no WebXR: the experience opens as a camera view with objects floating in front of you. That is the normal iPhone route.'; w.className='status'; return; }
      var ar=await navigator.xr.isSessionSupported('immersive-ar').catch(function(){return false;});
      if(!ar){ w.textContent='No AR session available here: the experience opens as a camera view with objects floating in front of you.'; w.className='status'; return; }
      var vr=await navigator.xr.isSessionSupported('immersive-vr').catch(function(){return false;});
      w.textContent=vr
        ? 'This is a headset: the experience will open in your room, and you point and pinch. Just tap Open the experience — there is nothing to type.'
        : 'This phone can find real surfaces: objects will sit on your table and stay there when you walk around.';
      w.className='status ok';
    }catch(e){ w.textContent='Could not tell what this device supports; open the experience and it will work out the best version itself.'; }
  })();
</script>
</main></body></html>`;
}
