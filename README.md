# Agent Eye View — Demo

A stakeholder-facing preview of **Agent Eye View**, a Search Influence diagnostic that shows what an AI agent or crawler actually perceives on a web page: the readable content, the structured data it finds, the accessibility/semantic outline, and the answer an agent could confidently assemble about the business.

Paste a page's HTML and it runs **100% in the browser** — nothing is uploaded, fetched, or stored. Click **Load sample page** to see it work out of the box.

> This is a public-but-unlisted demo: `robots.txt` blocks search indexing so the URL stays shareable-only. It uses fictional sample data and is for demonstration, not a production deployment.

---

## Live demo

GitHub Pages serves the tool from `index.html` at the repo's Pages URL (see the repo's **Settings → Pages**, or the link in the repo description).

## What it checks

- **AI Access & Crawlability** — robots/snippet directives (noindex, nosnippet, max-snippet, noai, `data-nosnippet`), JS-dependency/content-visibility risk, canonical
- **Readable content** — distilled main text, depth, and extractable structure (lists, tables, Q&A, answer-first)
- **Structured data** — JSON-LD types, schema completeness vs missing properties, `sameAs`/author/freshness
- **Semantic & accessibility outline** — landmarks, alt-text coverage, link-text quality, form labels, language
- **The answer an agent could assemble** — interactive query simulator, an 8-intent answerability matrix, per-fact confidence/provenance, and the most quotable snippet
- **Agent-readiness score + prioritized fixes**, exportable as Markdown or print-to-PDF

## Updating the demo

The page is a single self-contained file. To refresh it, re-copy the source tool over `index.html` and push:

```bash
cp ../si-agent-eye-view.html index.html
git add index.html && git commit -m "Update Agent Eye View demo" && git push
```

---

Built by [Search Influence](https://www.searchinfluence.com/) · New Orleans, LA
