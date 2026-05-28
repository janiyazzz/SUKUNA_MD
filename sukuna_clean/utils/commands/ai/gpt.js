/**
 * GPT Command — Chat with AI
 * Usage: .gpt <question>
 */

const https = require('https');

function callGPT(prompt) {
    return new Promise((resolve, reject) => {
        const url = `https://apis.prexzyvilla.site/ai/gpt?prompt=${encodeURIComponent(prompt)}`;
        https.get(url, { timeout: 30000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.response || json.result || json.message || json.text || data);
                } catch (e) {
                    resolve(data);
                }
            });
        }).on('error', reject);
    });
}

module.exports = {
    name: 'gpt',
    aliases: ['ai', 'chatgpt', 'askai'],
    description: 'Chat with GPT AI',
    category: 'ai',
    async execute({ reply, args }) {
        if (!args.length) {
            return reply(
                `🤖 *GPT AI Chat*\n\n` +
                `Usage: .gpt <your question>\n` +
                `Example: .gpt What is the meaning of life?`
            );
        }

        const prompt = args.join(' ');
        
        try {
            await reply('🤖 *Thinking...*');
            const response = await callGPT(prompt);
            
            reply(
                `🤖 *GPT AI*\n\n` +
                `Q: ${prompt}\n\n` +
                `A: ${response}`
            );
        } catch (err) {
            reply('❌ AI service is currently unavailable. Please try again later.');
        }
    }
};
