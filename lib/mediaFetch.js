/**
 * mediaFetch — shared helper for prexzyvilla general-purpose media endpoints
 * (profile pics, tiktok clips, etc). Calls an endpoint and walks the JSON
 * response to pull out any usable image/video URL(s).
 */
'use strict';
const axios = require('axios');

const IMG_RE = /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i;
const VID_RE = /\.(mp4|webm|mov|m4v)(\?|$)/i;
const URL_RE = /^https?:\/\//i;

function walk(node, out) {
    if (!node) return;
    if (typeof node === 'string') {
        if (URL_RE.test(node) && (IMG_RE.test(node) || VID_RE.test(node))) out.push(node);
        return;
    }
    if (Array.isArray(node)) { for (const v of node) walk(v, out); return; }
    if (typeof node === 'object') { for (const v of Object.values(node)) walk(v, out); }
}

async function fetchRaw(endpoint, { timeout = 20000 } = {}) {
    const r = await axios.get(endpoint, {
        timeout,
        headers: { 'User-Agent': 'Mozilla/5.0 (SUKUNA-MD)' },
        validateStatus: () => true,
    });
    if (r.status >= 400) throw new Error(`API ${r.status}`);
    return r.data;
}

/** Returns { url, isVideo } for the first media URL found in the response. */
async function fetchOneMedia(endpoint, opts) {
    const data = await fetchRaw(endpoint, opts);
    const urls = [];
    walk(data, urls);
    if (!urls.length) throw new Error('No media URL in response');
    const url = urls[0];
    return { url, isVideo: VID_RE.test(url) };
}

/**
 * Calls the endpoint `count` times (each call is expected to return a fresh
 * random pick) and returns up to `count` deduplicated { url, isVideo } items.
 */
async function fetchManyMedia(endpoint, count, opts) {
    const results = await Promise.allSettled(
        Array.from({ length: count }, () => fetchOneMedia(endpoint, opts))
    );
    const seen = new Set();
    const out = [];
    for (const r of results) {
        if (r.status === 'fulfilled' && !seen.has(r.value.url)) {
            seen.add(r.value.url);
            out.push(r.value);
        }
    }
    return out;
}

module.exports = { fetchRaw, fetchOneMedia, fetchManyMedia };
