// api/fetch.js — server-side HTML fetch for Agent Eye View's "Analyze a URL" mode.
//
// A browser page can't read another site's HTML (CORS / same-origin policy),
// so this Vercel serverless function fetches the page server-side and hands the
// raw HTML back to the tool. It deliberately does NOT execute JavaScript — it
// returns the served HTML the way most AI crawlers actually see it.
//
// Hardened against SSRF: public http(s) hosts only, every redirect hop is
// re-validated, private/link-local/metadata addresses are blocked, with a
// timeout, a response-size cap, and an HTML-only content-type guard.

import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 5;
const UA =
  'SearchInfluence-AgentEyeView/1.0 (+https://www.searchinfluence.com; site audit)';

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true;            // link-local + cloud metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const a = ip.toLowerCase();
    if (a === '::1' || a === '::') return true;
    if (a.startsWith('fc') || a.startsWith('fd')) return true; // unique-local
    if (a.startsWith('fe80')) return true;                     // link-local
    const m = a.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);          // IPv4-mapped
    if (m) return isPrivateIp(m[1]);
    return false;
  }
  return true; // unknown form → unsafe
}

async function assertPublicHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) {
    throw new Error('Blocked host');
  }
  if (net.isIP(h)) {
    if (isPrivateIp(h)) throw new Error('Blocked address');
    return;
  }
  let addrs;
  try {
    addrs = await dns.lookup(h, { all: true });
  } catch {
    throw new Error('DNS resolution failed');
  }
  if (!addrs.length) throw new Error('No address');
  for (const a of addrs) {
    if (isPrivateIp(a.address)) throw new Error('Blocked address');
  }
}

function validateUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed');
  }
  return u;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rawParam = req.query && req.query.url;
  const raw = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  if (!raw) {
    res.status(400).json({ error: 'Missing ?url= parameter' });
    return;
  }

  let current;
  try {
    current = validateUrl(raw);
  } catch (e) {
    res.status(400).json({ error: e.message });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let redirects = 0;
    let response;
    // Follow redirects manually so each hop's host can be re-validated (SSRF).
    for (;;) {
      await assertPublicHost(current.hostname);
      response = await fetch(current.href, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,text/xml' }
      });
      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get('location')
      ) {
        if (++redirects > MAX_REDIRECTS) throw new Error('Too many redirects');
        const loc = new URL(response.headers.get('location'), current.href);
        if (loc.protocol !== 'http:' && loc.protocol !== 'https:') {
          throw new Error('Unsafe redirect');
        }
        current = loc;
        continue;
      }
      break;
    }

    const ctype = response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml|text\/xml|application\/xml/i.test(ctype)) {
      res
        .status(415)
        .json({ error: 'Not an HTML page (content-type: ' + (ctype || 'unknown') + ')' });
      return;
    }
    const declaredLen = Number(response.headers.get('content-length') || 0);
    if (declaredLen && declaredLen > MAX_BYTES) {
      res.status(413).json({ error: 'Page is too large to analyze' });
      return;
    }

    // Stream with a hard size cap so a huge/streamed page can't blow memory.
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_BYTES) {
        try { await reader.cancel(); } catch {}
        res.status(413).json({ error: 'Page is too large to analyze' });
        return;
      }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks).toString('utf8');

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, finalUrl: current.href, status: response.status, html });
  } catch (e) {
    const msg = e && e.name === 'AbortError' ? 'The page took too long to respond' : (e && e.message) || 'Fetch failed';
    res.status(502).json({ error: msg });
  } finally {
    clearTimeout(timer);
  }
}
