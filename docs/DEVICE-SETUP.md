# Device setup

You do this once per device. It takes about five minutes.

## Why there is a setup step

The camera, motion sensors and AR only work on a secure connection. Your laptop creates its own certificate for this. Your device does not know that certificate yet: a Quest accepts a warning once, a phone installs the certificate once. After that, the device opens the experience like any normal website.

## Before you start

1. The laptop and the device are on the same Wi-Fi.
2. `npm run dev` is running on the laptop. The terminal shows an address and a QR code.
3. On the first run the laptop asked for your password (macOS) or showed a security dialog (Windows). This trusts the certificate on the laptop itself. Phones need their own step, below.

## Meta Quest 3 (primary target)

The Quest cannot install a laptop certificate the way phones can, but its browser lets you accept the
warning once. Three ways work; the first is the one to use.

### Accept the warning (recommended, verified 2026-10-03)

1. Put the headset on, open the Quest browser and type the secure address from the terminal
   (`https://192.168.x.y:5173`). The QR code in the terminal is for phones; the headset has no camera scanner.
2. The browser shows a certificate warning. Choose **Advanced**, then **Proceed**.
3. You get the start screen with **Enter the room**. Tap it: you are in passthrough with a ray out of
   each hand. Pinch to select, pinch and move to drag, both hands to scale.

The browser remembers the exception for this address. When the laptop gets a new address (another
Wi-Fi), accept the warning once more.

### Cable

1. Turn on Developer Mode for the headset in the Meta Horizon app on your phone. You need a free Meta developer account for this.
2. Install Android platform-tools on the laptop, so the `adb` command exists.
3. Connect the Quest to the laptop with a USB cable. In the headset, allow the connection when asked.
4. On the laptop run `npm run dev -- --quest` and in the Quest browser open `http://localhost:5173`.

The headset talks to the laptop through the cable; no certificate at all. That run is plain HTTP, so
phones on the Wi-Fi cannot use it at the same time.

### Last resort: public tunnel

```
npm run dev -- --tunnel
```

The laptop opens a public address with a real certificate and prints it with a QR code. Any device can open it without setup. It is a little slower and needs internet access, but it always works. The first run downloads a small tool and can take a minute.

## iPhone

1. Scan the QR code with the camera app and open the link. The first page is the device setup page. If you land on the experience instead, add `/setup` to the address.
2. Tap **Download certificate**. Safari asks to allow a configuration profile. Allow it.
3. Open **Settings**. At the top, tap **Profile Downloaded**, then **Install**. Enter your passcode.
4. Go to **Settings → General → About → Certificate Trust Settings**. Switch on the entry that starts with **mkcert**.
5. Go back to Safari and reload the page. The padlock should be closed and the page should say the connection is secure.
6. Tap **Open the experience**. Allow camera and motion access when asked.

If the download does not work over the secure address, use the plain address the setup page shows at the bottom. It looks like `http://192.168.x.y:5174/cert/` and works on the same Wi-Fi.

## Android

1. Scan the QR code and open the link. The first page is the device setup page. If you land on the experience instead, add `/setup` to the address.
2. Tap **Download certificate**.
3. Open **Settings → Security (or Privacy) → More security settings → Encryption & credentials → Install a certificate → CA certificate**. Choose **Install anyway** and pick the downloaded file. The exact path differs a little between phones. Searching Settings for "certificate" finds it.
4. Reload the page in Chrome. The padlock should be closed.
5. Tap **Open the experience**. Allow camera access when asked.

If the download does not work over the secure address, use the plain address at the bottom of the setup page (`http://192.168.x.y:5174/cert/`).

Objects that stick to real surfaces need Google Play Services for AR. Chrome offers to install it the first time, if your phone supports it. Coming in the next version of the template; see [DEVICE-PROFILES.md](DEVICE-PROFILES.md).

## Check that everything works

Open the check page on the device: its address is in the terminal (`/check`). It shows a list: secure connection, camera, motion, AR, speech. Green means available, yellow means limited, red means design around it.

Tap **Send results to laptop**. On the laptop, `curl -sk https://localhost:5173/api/diag` prints what the device reported.

## Common problems

**The QR code opens but the page says the connection is not secure.** The certificate step did not finish. On iPhone, check that the switch under Certificate Trust Settings is on. On Android, check that the certificate appears under Trusted credentials → User.

**The camera does not start.** You may have denied access. On iPhone: Settings → Safari → Camera → Allow. On Android: tap the padlock in Chrome → Permissions → Camera.

**The phone cannot reach the address at all.** Check that both devices are on the same Wi-Fi. Some university or guest networks block devices from talking to each other (client isolation). Two ways out:

1. **Hotspot.** Turn on the personal hotspot of the phone (or of a second phone), join it from the laptop, and run `npm run dev` again. The laptop has a new address, so a new certificate and QR code are made; the phone does not need to redo the trust step. Nothing here needs the internet, so the hotspot can be offline.
2. **Tunnel.** `npm run dev -- --tunnel` gives a public address with a real certificate. Needs internet on both sides and is a little slower.

**The address changed.** Your laptop got a new address from the Wi-Fi, which happens whenever you move to another network. The QR code belongs to one session, not to the project: yesterday's QR silently stops working. Restart `npm run dev` and scan the fresh QR; it makes a new certificate for the new address. The phone does not need to redo the trust step. `npm run show-url` prints the current address at any time.

**The laptop asks for a password every time.** Say yes once and it stops. If your laptop is managed by an organisation and refuses, run `npm run dev -- --no-trust`. Phones still work; only the laptop preview shows a warning.
