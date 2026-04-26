# VuCalc+ — Deployment Guide

This is a complete, ready-to-deploy Progressive Web App (PWA) for VuCalc+. Once deployed, you and your brokers can install it on iPhone, iPad, Android, or use it in any modern browser.

## What you have

A folder (`vucalc-app/`) containing the full source code. You'll deploy this to a hosting service (free), then anyone who visits the URL on their iPhone can tap "Add to Home Screen" to install it like a native app.

---

## Step 1 — Install Node.js (one-time, ~5 minutes)

Node.js is needed to build the app. If you already have it (you can check by running `node --version` in Terminal), skip ahead.

1. Visit <https://nodejs.org>
2. Download the **LTS** version (recommended for most users)
3. Run the installer, accept defaults

Verify it worked: open Terminal (Mac: ⌘+Space → "Terminal") and run:
```
node --version
```
You should see something like `v20.x.x`.

---

## Step 2 — Test the app locally (5 minutes)

1. Unzip `vucalc-app.zip` somewhere convenient (e.g., your Desktop)
2. Open Terminal and navigate into the folder:
   ```
   cd ~/Desktop/vucalc-app
   ```
3. Install dependencies (one-time, takes ~1 minute):
   ```
   npm install
   ```
4. Start the dev server:
   ```
   npm run dev
   ```
5. Open <http://localhost:5173> in your browser. You should see VuCalc+ running.

To stop it later: press `Ctrl+C` in the terminal.

---

## Step 3 — Deploy to Vercel (10 minutes, free)

Vercel is the easiest hosting option. It gives you a free public URL like `vucalc-plus.vercel.app`.

### Option A — Drag and drop (easiest, no GitHub needed)

1. First, build the production version locally:
   ```
   npm run build
   ```
   This creates a `dist/` folder.

2. Go to <https://vercel.com/signup> and sign up (use GitHub, Google, or email).

3. Once signed in, click **"Add New" → "Project"**.

4. Skip the "Import Git Repository" step. At the bottom, click **"Browse all templates"** then look for the **"Deploy from CLI"** option, OR:

5. **Easier alternative:** install the Vercel CLI and deploy in one command:
   ```
   npm install -g vercel
   vercel
   ```
   Follow the prompts. When asked which directory to deploy, just press Enter for the current folder. Vercel will detect it as a Vite project and deploy automatically.

6. After ~30 seconds, you'll get a URL. That's your live app.

### Option B — Connect GitHub (better for ongoing updates)

1. Create a free GitHub account if you don't have one.
2. Create a new repository called `vucalc-plus`.
3. Push the code:
   ```
   cd ~/Desktop/vucalc-app
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/vucalc-plus.git
   git push -u origin main
   ```
4. On Vercel: **"Add New" → "Project" → import the repo**. Click Deploy.
5. Now every time you `git push`, Vercel auto-redeploys. Updates go live in ~30 seconds.

---

## Step 4 — Add the app to an iPhone

Once you have your Vercel URL (e.g., `https://vucalc-plus.vercel.app`):

1. Open **Safari** on the iPhone (must be Safari — Chrome doesn't support PWA install on iOS)
2. Visit the URL
3. Tap the **Share** button (the square with the arrow pointing up, at the bottom of the screen)
4. Scroll down and tap **"Add to Home Screen"**
5. Confirm the name (it should already say "VuCalc+") and tap **Add**

The icon will appear on your home screen. Tap it — it launches in full-screen mode, no browser bar, just like a native app.

### What works in PWA mode on iOS

- Full-screen experience, no Safari toolbars
- Custom app icon on home screen
- Works offline once visited (service worker caches everything)
- Theme-coloured status bar
- All the calculator functionality

### What does NOT work in PWA mode on iOS (worth knowing)

- Push notifications (Apple's restriction — fine for a calculator)
- Background tasks
- Access to camera/contacts (we don't need these)

---

## Step 5 — Sharing with brokers and clients

Just send them the URL. They follow the same "Add to Home Screen" steps. No App Store, no installation hassles, no $99/year fee.

If you want a more polished URL (e.g., `vucalc.com`), buy a domain from Namecheap or Cloudflare (~$10/year) and point it to Vercel — Vercel has a one-click custom domain setup.

---

## Updating the app

When you want to change something:

1. Edit the relevant file (most likely `src/LoanCalculator.jsx`)
2. Test locally with `npm run dev`
3. Build with `npm run build`
4. If using Option A: run `vercel --prod` to redeploy
5. If using Option B: `git push` and Vercel auto-deploys

Users will get the update automatically next time they open the app — the service worker checks for updates in the background.

---

## When to upgrade to a real native app (App Store)

Stick with this PWA setup unless you specifically need:

- Listing in the Apple App Store as "VuCalc+"
- Push notifications
- Apple Pay or other native iOS APIs
- Premium-feel deep linking (e.g., `vucalc://something`)

If you do go that route later, the path is **Capacitor**: it wraps this same React code in a native iOS shell. Your code stays the same. You'd need:

- A Mac with Xcode installed
- An Apple Developer Program membership ($99/year)
- About a day of setup work

Happy to walk you through that whenever you're ready.

---

## File structure (for reference)

```
vucalc-app/
├── index.html              ← Entry HTML with iOS meta tags
├── package.json            ← Dependencies
├── vite.config.js          ← PWA & build config
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.jsx            ← React entry point
│   ├── index.css           ← Global styles (iOS safe-areas, etc.)
│   └── LoanCalculator.jsx  ← The full app
└── public/                 ← Static assets
    ├── logo.svg
    ├── favicon.ico
    ├── icon-192.png
    ├── icon-512.png
    ├── icon-maskable-512.png
    └── apple-touch-icon*.png
```

---

## Troubleshooting

**"command not found: npm"** — Node.js didn't install correctly. Reinstall from nodejs.org.

**"command not found: vercel"** — Run `npm install -g vercel` again. On Mac you may need `sudo npm install -g vercel`.

**App doesn't show "Add to Home Screen"** — Make sure you're using Safari, not Chrome, on iOS. Chrome on iOS doesn't support this.

**App icon looks wrong on home screen** — iOS caches icons aggressively. Remove from home screen, clear Safari cache (Settings → Safari → Clear History), then re-add.

**Anything else** — let me know and I'll help debug.
# vucalc-plus
# vucalc-plus
