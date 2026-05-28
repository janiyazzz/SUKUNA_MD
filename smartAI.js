/**
 * Smart AI helper — multi-endpoint with conversation memory.
 *
 * Endpoints (tried in order, first non-empty wins):
 *   1) https://apis.prexzyvilla.site/ai/gpt-5?text=<prompt>
 *   2) https://apis.prexzyvilla.site/ai/ch?q=<prompt>
 *   3) https://apis.prexzyvilla.site/ai/aichat?prompt=<prompt>
 *
 * Conversation memory:
 *   - Per-conversation key (e.g. WhatsApp JID).
 *   - Keeps last MAX_TURNS user/assistant pairs in RAM.
 *   - Auto-injected into the prompt so the model "remembers" context.
 */

const axios = require('axios');

const MAX_TURNS  = 12;     // remember last 12 turns per user
const TIMEOUT_MS = 20000;
const memory = new Map();  // key -> [{ role:'user'|'assistant', text }]

function _hist(key) {
    if (!memory.has(key)) memory.set(key, []);
    return memory.get(key);
}

function clearMemory(key) {
    if (key) memory.delete(key); else memory.clear();
}

function pushTurn(key, role, text) {
    if (!key || !text) return;
    const h = _hist(key);
    h.push({ role, text: String(text).slice(0, 1200) });
    while (h.length > MAX_TURNS * 2) h.shift();
}

function _renderTranscript(key) {
    const h = _hist(key);
    if (!h.length) return '';
    return h.map(t => (t.role === 'user' ? 'User: ' : 'Assistant: ') + t.text).join('\n');
}

function _extract(data) {
    if (data == null) return null;
    if (typeof data === 'string') return data.trim() || null;
    return (
        data.result   || data.response || data.reply  ||
        data.answer   || data.message  || data.text   ||
        data.output   || data.data     || data.gpt    ||
        null
    );
}

async function _hit(url) {
    try {
        const { data } = await axios.get(url, {
            timeout: TIMEOUT_MS,
            headers: { 'User-Agent': 'Mozilla/5.0 SukunaMD' },
            validateStatus: () => true,
        });
        const out = _extract(data);
        return (out && String(out).trim()) || null;
    } catch (_) { return null; }
}

/**
 * Ask AI with memory.
 * @param {object} opts
 *   - key       conversation id (jid). Required for memory.
 *   - system    persona / system prompt
 *   - user      latest user message
 *   - remember  store this turn in memory (default true)
 */
async function ask({ key, system = '', user, remember = true }) {
    if (!user || !String(user).trim()) return null;
    const userText = String(user).trim();

    const transcript = key ? _renderTranscript(key) : '';
    const composed =
        (system ? system.trim() + '\n\n' : '') +
        (transcript ? 'Conversation so far:\n' + transcript + '\n\n' : '') +
        'User: ' + userText + '\nAssistant:';

    const enc = encodeURIComponent(composed);

    const endpoints = [
        `https://apis.prexzyvilla.site/ai/gpt-5?text=${enc}`,
        `https://apis.prexzyvilla.site/ai/ch?q=${enc}`,
        `https://apis.prexzyvilla.site/ai/aichat?prompt=${enc}`,
    ];

    let reply = null;
    for (const url of endpoints) {
        reply = await _hit(url);
        if (reply) break;
    }

    if (reply && remember && key) {
        pushTurn(key, 'user', userText);
        pushTurn(key, 'assistant', reply);
    }
    return reply;
}

module.exports = { ask, pushTurn, clearMemory };
