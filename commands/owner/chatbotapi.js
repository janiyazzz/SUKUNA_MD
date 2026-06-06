/**
 * .chatbotapi — hot-swap the chatbot's AI key (Groq or OpenAI).
 *
 * Usage:
 *   .chatbotapi groq <key>     — set a Groq key (gsk_...)
 *   .chatbotapi openai <key>   — set an OpenAI key (sk-...)
 *   .chatbotapi status         — show active provider + masked key
 *   .chatbotapi reset          — restore the original default Groq key
 *
 * Rewrites the AI CONFIG block inside utils/smartAI.js, validates the key
 * with a tiny live call, then clears the require cache so the chatbot
 * picks up the new key immediately — no bot restart needed.
 */
const fs    = require('fs');
const path  = require('path');
const axios = require('axios');

const SMART_AI_PATH = path.join(__dirname, '..', '..', 'utils', 'smartAI.js');

const PROVIDERS = {
    groq: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
        prefix: 'gsk_',
        testModel: 'llama-3.1-8b-instant',
    },
    openai: {
        url: 'https://api.openai.com/v1/chat/completions',
        models: ['gpt-4o-mini', 'gpt-3.5-turbo'],
        prefix: 'sk-',
        testModel: 'gpt-4o-mini',
    },
};

const DEFAULT_BLOCK =
`// ===== BEGIN AI CONFIG (managed by .chatbotapi) =====
const AI_PROVIDER = 'groq';
const AI_API_KEY  = process.env.GROQ_API_KEY || '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';
const AI_URL      = 'https://api.groq.com/openai/v1/chat/completions';
const AI_MODELS   = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
// ===== END AI CONFIG =====`;

function mask(key) {
    if (!key || key.length < 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
}

async function testKey(provider, key) {
    const cfg = PROVIDERS[provider];
    try {
        const { status, data } = await axios.post(cfg.url, {
            model: cfg.testModel,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
        }, {
            timeout: 15000,
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            validateStatus: () => true,
        });
        if (status >= 200 && status < 300) return { ok: true };
        return { ok: false, error: data?.error?.message || `HTTP ${status}` };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

function buildBlock(provider, key) {
    const cfg = PROVIDERS[provider];
    const modelsLiteral = '[' + cfg.models.map(m => `'${m}'`).join(', ') + ']';
    return `// ===== BEGIN AI CONFIG (managed by .chatbotapi) =====
const AI_PROVIDER = '${provider}';
const AI_API_KEY  = '${key.replace(/'/g, "\\'")}';
const AI_URL      = '${cfg.url}';
const AI_MODELS   = ${modelsLiteral};
// ===== END AI CONFIG =====`;
}

function writeBlock(newBlock) {
    const src = fs.readFileSync(SMART_AI_PATH, 'utf8');
    const re  = /\/\/ ===== BEGIN AI CONFIG[\s\S]*?\/\/ ===== END AI CONFIG =====/;
    if (!re.test(src)) throw new Error('AI CONFIG markers not found in utils/smartAI.js');
    fs.writeFileSync(SMART_AI_PATH, src.replace(re, newBlock));
    try { delete require.cache[require.resolve(SMART_AI_PATH)]; } catch (_) {}
}

function readCurrent() {
    try {
        const src = fs.readFileSync(SMART_AI_PATH, 'utf8');
        const provider = (src.match(/AI_PROVIDER\s*=\s*'([^']+)'/) || [])[1] || 'unknown';
        const key      = (src.match(/AI_API_KEY\s*=\s*(?:process\.env\.[A-Z_]+\s*\|\|\s*)?'([^']+)'/) || [])[1] || '';
        return { provider, key };
    } catch {
        return { provider: 'unknown', key: '' };
    }
}

module.exports = {
    name: 'chatbotapi',
    aliases: ['setchatbotapi', 'chatapi'],
    description: 'Set or replace the chatbot AI API key (Groq or OpenAI)',
    usage: '.chatbotapi groq|openai <key> | status | reset',
    category: 'owner',

    async execute({ reply, args }) {
        const sub = (args[0] || '').toLowerCase();

        if (!sub || sub === 'status' || sub === 'help') {
            const cur = readCurrent();
            return reply(
                '🔑 *Chatbot API*\n\n' +
                `Provider: *${cur.provider}*\n` +
                `Key:      \`${mask(cur.key)}\`\n\n` +
                '*Usage:*\n' +
                '• `.chatbotapi groq <key>`   — set a Groq key (gsk_...)\n' +
                '• `.chatbotapi openai <key>` — set an OpenAI key (sk-...)\n' +
                '• `.chatbotapi status`        — show active key\n' +
                '• `.chatbotapi reset`         — restore default Groq key\n\n' +
                '_Use this when the current API key gets revoked or hits its rate limit._'
            );
        }

        if (sub === 'reset') {
            try {
                writeBlock(DEFAULT_BLOCK);
                return reply('🔄 *Chatbot API reset to the default Groq key.*');
            } catch (e) {
                return reply(`❌ Failed to reset: ${e.message}`);
            }
        }

        if (sub === 'groq' || sub === 'openai') {
            const provider = sub;
            const key = (args[1] || '').trim();
            if (!key) return reply(`❌ Usage: \`.chatbotapi ${provider} <key>\``);

            const cfg = PROVIDERS[provider];
            if (!key.startsWith(cfg.prefix)) {
                return reply(`❌ That doesn't look like a ${provider.toUpperCase()} key (should start with \`${cfg.prefix}\`).`);
            }
            if (key.length < 20) return reply('❌ Key looks too short.');

            await reply(`🔍 Testing ${provider.toUpperCase()} key \`${mask(key)}\`...`);

            const test = await testKey(provider, key);
            if (!test.ok) return reply(`❌ Key rejected by ${provider.toUpperCase()}:\n_${test.error}_`);

            try {
                writeBlock(buildBlock(provider, key));
            } catch (e) {
                return reply(`❌ Failed to write key: ${e.message}`);
            }

            return reply(
                '✅ *Chatbot API updated!*\n\n' +
                `Provider: *${provider}*\n` +
                `Key:      \`${mask(key)}\`\n\n` +
                '🤖 The chatbot is now using the new key — no restart needed.'
            );
        }

        return reply('❌ Unknown sub-command. Try `.chatbotapi status`.');
    },
};
