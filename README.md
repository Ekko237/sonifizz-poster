<p align="center">
  English · <a href="README.zh-CN.md">中文</a>
</p>

<h1 align="center">SONIFIZZ Poster</h1>

<p align="center">A vertical touch-kiosk web prototype for a music-festival booth. Passers-by pick a persona, write a line, and have it printed as their own poster in a minute, take it away by QR code, then pick up a can of sparkling water at the booth with the poster. SONIFIZZ is a fictional sparkling-water brand.</p>

<p align="center">
  <a href="https://ekko237.github.io/sonifizz-poster/"><img src="https://img.shields.io/badge/live_demo-ekko237.github.io-24292f?style=flat" alt="Live demo" /></a>
  &nbsp;
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-24292f?style=flat&amp;logo=github&amp;logoColor=white" alt="MIT License" /></a>
</p>

<p align="center">
  <a href="https://ekko237.github.io/sonifizz-poster/">
    <img src="docs/idle.webp" alt="Desktop demo: a standing touch kiosk in the center, with notes in the columns on either side" width="100%">
  </a>
</p>

## How to play

1. **Pick a persona.** Six music personas match six flavors. Not sure? Tap a rhythm 4 times. It recommends a persona from the speed and how steady you are, and the BPM is printed on the poster.
2. **Pick a style and write a line.** Four looks (neon night, vintage screen print, pop collage, minimal Swiss). Write a nickname and one line. You can tap the microphone and say it once, turning your own voice into the voiceprint on the poster.
3. **Take it away by QR code.** The poster fills from the bottom up like a glass of sparkling water, then flies to the result page. Scan with a phone to open the share page, where you can save the image, save it as a video, and share it with friends, and pick up a can at the booth with the redemption code on the page.

<table>
  <tr>
    <td width="33%"><img src="docs/persona.webp" alt="Choose a music persona" width="100%"></td>
    <td width="33%"><img src="docs/input.webp" alt="Write a line" width="100%"></td>
    <td width="33%"><img src="docs/result.webp" alt="Result page: the poster and the QR code" width="100%"></td>
  </tr>
</table>

## Four pages

| Page | File | Contents |
| --- | --- | --- |
| Big screen | `index.html` | The kiosk itself. On a computer it shows the whole standing machine and the notes on both sides. In a portrait window, or when the URL has `?kiosk=1`, it shows only the screen and fills the window |
| Phone share page | `share.html` | Opens after the scan: replay the pour, listen to the line's voiceprint, save the image or the video, redeem a can, invite friends |
| Queue prefill page | `prefill.html` | While waiting in line, choose and fill it in on your phone first, get a 4-digit pickup number, and enter it on the big screen when it is your turn |
| Admin console | `admin.html` | Adjust parameters such as the length of each round and how many times the poster can be swapped. See the persona and style distribution, block counts, and reports, and manage the sensitive-word list. Tapping the logo 5 times in a row on the big screen opens it too |

<table>
  <tr>
    <td width="30%"><img src="docs/share.webp" alt="Phone share page: poster, listen, save, and redeem" width="100%"></td>
    <td width="70%"><img src="docs/admin.webp" alt="Admin console: data cards, parameters, persona distribution, and the safety word list" width="100%"></td>
  </tr>
</table>

## Design notes

* **Words a visitor writes only go into the layout.** The nickname and the line end up as text laid over the poster, and never enter the image-generation prompt. Diversion info (URLs, phone numbers, WeChat IDs, account names) and sensitive words are blocked with the same rules in three places: the big screen, the prefill page, and the share page.
* **The same seed draws the same picture.** A poster is decided by the persona, the style, and a random seed. The share link carries only those parameters. The phone redraws from the seed, with no image upload.
* **Poster backgrounds are a pool generated ahead of time.** `assets/pool` holds six personas times four styles, 4 AI-generated backgrounds in each group, and `assets/pool/s` holds the matching small images. The text, voiceprint, and brand bar on the poster are drawn on the canvas on the spot by `js/poster.js`.
* **All sound is synthesized on the spot.** Each of the six personas has a signature tone. While generating, the line's voiceprint is played as a short melody. There are no audio files.
* **Occupancy control.** Each round has a time limit. If it sits idle, a "Still there?" prompt appears. After a countdown on the result page it returns to the home screen. Peak mode shortens the time and turns off swapping the poster.
* **First-time guide.** The first time it opens, it asks whether you want a walkthrough, pointing at what to tap.
* **Chinese and English.** Switch language at the top right of the big screen. The phone pages follow.

In the prototype, settings, stats, the queue, and redemption records all live in the browser's localStorage. The big screen, the phone pages, and the admin console only share data when they are opened in the same browser on the same computer.

## Run locally

No install or build needed. After downloading, double-click `index.html` to open it. A local server is more complete (the dots in the pour animation can sample the illustration colors):

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/ .

## Common Questions

**Is SONIFIZZ a real brand?**  
No. SONIFIZZ is a fictional sparkling-water brand.

**Does it need a backend?**  
No. In the prototype, settings, stats, the queue, and redemption records all live in the browser's localStorage. The big screen, the phone pages, and the admin console only share data when they are opened in the same browser on the same computer.

**Why run a local server?**  
No install or build needed. After downloading, double-click `index.html` to open it. A local server is more complete: the dots in the pour animation can sample the illustration colors.

## Directory

```
index.html  share.html  prefill.html  admin.html  404.html
css/        base.css shared styles, screen.css big screen, mobile.css phone pages, admin.css admin
js/
  config.js     personas, styles, default settings, bilingual copy
  store.js      local storage, share-link encoding and decoding
  safety.js     content-safety rules and word list
  poster.js     poster drawing
  sound.js      sound synthesis
  scene.js      desktop-demo background
  fit.js        shell scaling
  pour.js       pour animation while generating
  voicerec.js   say it once to record a voiceprint
  screen.js     big-screen state machine and per-screen logic
  tour.js       first-time guide
  share.js  reveal.js  prefill.js  admin.js   per-page scripts
assets/     brand art (cans, share cover) and the poster-background pool
vendor/     fonts, icons, QR code, and the Chinese line-breaking library
docs/       screenshots for the README
```

## License

Code is released under the [MIT License](LICENSE).

Third-party assets are used under their own licenses: the Doto font (SIL OFL 1.1, see `vendor/fonts/OFL.txt`), 得意黑 Smiley Sans (SIL OFL 1.1, see `vendor/fonts/smiley/OFL.txt`), Phosphor icons (MIT), qrcode-generator (MIT), and the BudouX Chinese line-breaking model (Apache-2.0, see the header of `vendor/budoux-zh.js`).
