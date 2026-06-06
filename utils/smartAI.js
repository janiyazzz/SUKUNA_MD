/**
 * Smart AI helper — Groq or OpenAI powered with conversation memory.
 *
 * The block between BEGIN AI CONFIG and END AI CONFIG is rewritten by
 * the `.chatbotapi` command. Do not remove the marker comments.
 */
const axios = require('axios');

// ===== BEGIN AI CONFIG (managed by .chatbotapi) =====
const AI_PROVIDER = 'groq';
const AI_API_KEY  = process.env.GROQ_API_KEY || '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';
const AI_URL      = 'https://api.groq.com/openai/v1/chat/completions';
const AI_MODELS   = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
// ===== END AI CONFIG =====

const MAX_TURNS    = 12;
const TIMEOUT_MS   = 25000;

const memory = new Map();

function _hist(key) { if (!memory.has(key)) memory.set(key, []); return memory.get(key); }
function clearMemory(key) { if (key) memory.delete(key); else memory.clear(); }
function pushTurn(key, role, text) {
    if (!key || !text) return;
    const h = _hist(key);
    h.push({ role, content: String(text).slice(0, 1500) });
    while (h.length > MAX_TURNS * 2) h.shift();
}

async function _callAI(model, messages) {
    try {
        const { data } = await axios.post(AI_URL, {
            model,
            messages,
            temperature: 0.8,
            max_tokens: 1024,
        }, {
            timeout: TIMEOUT_MS,
            headers: {
                'Authorization': `Bearer ${AI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            validateStatus: () => true,
        });
        const txt = data?.choices?.[0]?.message?.content;
        return (txt && String(txt).trim()) || null;
    } catch (e) {
        console.error('[AI]', AI_PROVIDER, model, e.message);
        return null;
    }
}

async function ask({ key, system = '', user, remember = true }) {
    if (!user || !String(user).trim()) return null;
    const userText = String(user).trim();

    const history = key ? _hist(key).slice() : [];
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    for (const t of history) messages.push({ role: t.role, content: t.content });
    messages.push({ role: 'user', content: userText });

    let reply = null;
    for (const model of AI_MODELS) {
        reply = await _callAI(model, messages);
        if (reply) break;
    }

    if (reply && remember && key) {
        pushTurn(key, 'user', userText);
        pushTurn(key, 'assistant', reply);
    }
    return reply;
}

function getProviderInfo() {
    return { provider: AI_PROVIDER, key: AI_API_KEY, url: AI_URL, models: AI_MODELS };
}

module.exports = { ask, pushTurn, clearMemory, getProviderInfo };
