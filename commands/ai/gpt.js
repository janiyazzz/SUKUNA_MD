/**
 * GPT Command — Chat with AI (GPT-5 Model)
 * Usage: .gpt <question>
 */

const https = require('https');

function callGPT(prompt) {
    return new Promise((resolve, reject) => {
        const url = `https://apis.prexzyvilla.site/ai/gpt-5?text=${encodeURIComponent(prompt)}`;
        https.get(url, { timeout: 30000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    
                    // Defensive parsing: gpt-5 endpoint returns { status, statusCode, text, ... }
                    if (json && typeof json === 'object') {
                        // Primary: text field (standard for gpt-5)
                        if (json.text && typeof json.text === 'string') {
                            resolve(json.text);
                            return;
                        }
                        // Fallback chain for alternative response shapes
                        if (json.response && typeof json.response === 'string') {
                            resolve(json.response);
                            return;
                        }
                        if (json.result && typeof json.result === 'string') {
                            resolve(json.result);
                            return;
                        }
                        if (json.message && typeof json.message === 'string') {
                            resolve(json.message);
                            return;
                        }
                    }
                    
                    // Last resort: return raw data
                    resolve(String(data).trim());
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

module.exports = {
    name: 'gpt',
    aliases: ['ai', 'chatgpt', 'askai'],
    description: 'Chat with GPT-5 AI model',
    category: 'ai',
    async execute({ reply, args }) {
        if (!args.length) {
            return reply(
                `🤖 *GPT-5 AI Chat*\n\n` +
                `Usage: .gpt <your question>\n` +
                `Example: .gpt What is the meaning of life?`
            );
        }

        const prompt = args.join(' ');
        
        try {
            await reply('🤖 *Thinking...*');
            const response = await callGPT(prompt);
            
            if (!response || response.trim().length === 0) {
                return reply('❌ Received empty response from AI service. Please try again.');
            }
            
            reply(
                `🤖 *GPT-5 AI*\n\n` +
                `Q: ${prompt}\n\n` +
                `A: ${response}`
            );
        } catch (err) {
            reply(`❌ AI service error: ${err.message || 'Please try again later.'}`);
        }
    }
};
