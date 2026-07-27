/**
 * AI Art Video Command
 * Optimized for SUKUNA MD by Manus (July 2026)
 * Usage: .aiartvideo <prompt>
 */

const axios = require('axios');

// Replicate API Configuration
const REPLICATE_API_TOKEN = 'r8_Ua9NNqwunA2oSxOrY72d3Dfa8MS1vHe4Izs74';

// List of reliable Replicate models to try in order
const MODELS = [
    {
        name: 'Runway Gen-4.5 (Cinematic)',
        url: 'https://api.replicate.com/v1/models/runwayml/gen-4.5/predictions',
        input: (prompt) => ({ prompt, duration: 5, aspect_ratio: "1:1" })
    },
    {
        name: 'Happy Horse 1.1 (Fast)',
        url: 'https://api.replicate.com/v1/models/alibaba/happyhorse-1.1/predictions',
        input: (prompt) => ({ prompt, duration: 5 })
    },
    {
        name: 'Seedance 2.0 (Stable)',
        url: 'https://api.replicate.com/v1/models/bytedance/seedance-2.0-fast/predictions',
        input: (prompt) => ({ prompt, duration: 5 })
    }
];

module.exports = {
    name: 'aiartvideo',
    aliases: ['artvideo', 'videogen', 'av'],
    description: 'Generate a high-quality AI art video from text',
    category: 'media',
    async execute({ sock, msg, from, reply, args }) {
        const prompt = args.join(' ');
        if (!prompt) {
            return reply('🎬 *SUKUNA AI VIDEO*\n\nPlease provide a prompt for the AI video.\nExample: .aiartvideo a futuristic city in the rain');
        }

        try {
            // Initial reaction to acknowledge request
            await sock.sendMessage(from, { react: { text: '🎬', key: msg.key } });
            await reply('⏳ *Generating your AI video...* This may take a minute.');

            let videoUrl = null;
            let usedModel = '';

            // 1. Try Replicate Models (Reliable & High Quality)
            for (const model of MODELS) {
                try {
                    console.log(`[aiartvideo] Trying ${model.name}...`);
                    const replicateRes = await axios.post(
                        model.url,
                        { input: model.input(prompt) },
                        {
                            headers: {
                                'Authorization': `Token ${REPLICATE_API_TOKEN}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 20000
                        }
                    );

                    let prediction = replicateRes.data;
                    let attempts = 0;
                    const maxAttempts = 30; // 30 * 5s = 150s max wait

                    while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        const pollRes = await axios.get(
                            prediction.urls.get,
                            {
                                headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` }
                            }
                        );
                        prediction = pollRes.data;
                        attempts++;
                    }

                    if (prediction.status === 'succeeded') {
                        videoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
                        usedModel = model.name;
                        break; // Success!
                    }
                } catch (e) {
                    console.error(`[aiartvideo] ${model.name} failed:`, e.message);
                }
            }

            // 2. Try Public API Fallbacks (Last Resort)
            if (!videoUrl) {
                const fallbacks = [
                    `https://api.maher-zubair.tech/ai/text2video?q=${encodeURIComponent(prompt)}`,
                    `https://api.siputzx.my.id/api/ai/text2video?prompt=${encodeURIComponent(prompt)}`
                ];

                for (const url of fallbacks) {
                    try {
                        console.log(`[aiartvideo] Trying fallback: ${url}`);
                        const res = await axios.get(url, { timeout: 30000 });
                        videoUrl = res.data.result || res.data.url || res.data.video;
                        if (videoUrl) {
                            usedModel = 'Public API Fallback';
                            break;
                        }
                    } catch (e) {
                        console.error(`[aiartvideo] Fallback failed:`, e.message);
                    }
                }
            }

            // Final Result Handling
            if (!videoUrl) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return reply('❌ *Error:* All video generation servers are currently overloaded. Please try again in a few minutes.');
            }

            await sock.sendMessage(from, {
                video: { url: videoUrl },
                mimetype: 'video/mp4',
                caption: `🎬 *AI ART VIDEO*\n\n📝 *Prompt:* ${prompt}\n🚀 *Model:* ${usedModel}\n\n> Generated by SUKUNA MD`,
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('[aiartvideo] Fatal Error:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            reply('❌ *Fatal Error:* AI Video generation failed. Please check your prompt and try again.');
        }
    }
};
