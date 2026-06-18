# Agent Eye View — Demo (Vercel)

A stakeholder-facing preview of **Agent Eye View**, a Search Influence diagnostic that shows what an AI agent or crawler actually perceives on a web page: the readable content, the structured data it finds, the accessibility/semantic outline, and the answer an agent could confidently assemble about the business.

Two tools share this deployment:

- **`/` — Agent Eye View** (on-site): what an AI agent perceives on one of *your* pages.
  - **Analyze a URL** (default) — type a page URL. A small serverless function (`/api/fetch`) fetches the page **server-side** and returns its raw HTML, which the tool then analyzes in your browser. This is the same raw HTML most AI crawlers see (JavaScript is **not** executed).
  - **Paste HTML** — paste a page's source. Runs 100% in your browser; nothing is sent anywhere.
- **`/offsite.html` — Off-Site Agent View**: what an agent can learn about the business *off* your site (LinkedIn, YouTube, Facebook, Wikipedia, directories). It fetches each public profile via `/api/fetch` to read the Open Graph snippet an agent would see, queries Wikidata/Wikipedia directly (CORS-enabled), and reports presence, agent-readability (login-walled profiles are flagged as a finding), linkage (`sameAs`), and consistency. It does **not** scrape gated/private content.

> Public-but-unlisted demo: `robots.txt` blocks search indexing so the URL stays shareable-only. Uses fictional sample data; for demonstration, not a production deployment.

---

## Why a serverless function?

A static page can't fetch another site's HTML — browser CORS / same-origin policy blocks it. The `/api/fetch` function runs outside the browser (where CORS doesn't apply), so the "Analyze a URL" mode works. The analysis itself stays entirely client-side. The function is hardened against SSRF (public http(s) hosts only, redirect re-validation, private/metadata IP blocking, timeout, size cap, HTML-only).

## Deploy to Vercel (one-time)

This repo is zero-config for Vercel: it serves `index.html` statically and runs `api/fetch.js` as a serverless function.

1. Go to **vercel.com → Add New… → Project**.
2. **Import** this GitHub repo (`aev-preview-q2-2026`).
3. Framework preset: **Other** (no build step needed). Click **Deploy**.
4. After deploy, the tool is live at `https://<project>.vercel.app/` and the URL mode works immediately.

Every `git push` to `main` then auto-deploys.

### Local preview (optional)

```bash
npm i -g vercel
vercel dev        # serves index.html + /api/fetch locally
```

## Structure

```
index.html      Agent Eye View — on-site diagnostic (single self-contained file)
offsite.html     Off-Site Agent View — off-site footprint audit
api/fetch.js     serverless server-side fetch (shared by both tools)
vercel.json      function config (15s max duration)
package.json     marks the function as ESM (Node ≥18)
robots.txt       Disallow: / (keeps the demo unindexed)
```

Both HTML files are copies of the source tools in the parent workspace. To refresh either:

```bash
cp ../si-agent-eye-view.html index.html
cp ../si-offsite-agent-view.html offsite.html
git add -A && git commit -m "Update demo tools" && git push
```

## Updating the tool

`index.html` is a copy of the source tool. To refresh it:

```bash
cp ../si-agent-eye-view.html index.html
git add index.html && git commit -m "Update Agent Eye View demo" && git push
```

(The source tool keeps the same `/api/fetch` endpoint constant, so URL mode keeps working after a re-copy. When opened as a plain local file with no backend, URL mode fails gracefully and prompts you to paste instead.)

---

Built by [Search Influence](https://www.searchinfluence.com/) · New Orleans, LA
