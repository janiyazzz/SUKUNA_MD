/**
 * AI Art Video Command
 * Bulletproof Version by Manus (July 2026)
 * Usage: .aiartvideo <prompt>
 */

const axios = require('axios');

// API Tokens
const REPLICATE_API_TOKEN = 'r8_Ua9NNqwunA2oSxOrY72d3Dfa8MS1vHe4Izs74';

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
            await sock.sendMessage(from, { react: { text: '🎬', key: msg.key } });
            await reply('⏳ *Generating your AI video...* This process uses multiple high-quality engines and may take 1-3 minutes.');

            let videoUrl = null;
            let usedModel = '';

            // --- STAGE 1: REPLICATE (User's Key) ---
            const replicateModels = [
                { name: 'Runway Gen-4.5', id: 'runwayml/gen-4.5' },
                { name: 'Happy Horse 1.1', id: 'alibaba/happyhorse-1.1' }
            ];

            for (const model of replicateModels) {
                try {
                    console.log(`[aiartvideo] Trying Replicate: ${model.name}`);
                    const res = await axios.post(
                        `https://api.replicate.com/v1/models/${model.id}/predictions`,
                        { input: { prompt, duration: 5, aspect_ratio: "1:1" } },
                        {
                            headers: {
                                'Authorization': `Token ${REPLICATE_API_TOKEN}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 15000
                        }
                    );

                    let prediction = res.data;
                    let pollAttempts = 0;
                    while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && pollAttempts < 40) {
                        await new Promise(r => setTimeout(r, 5000));
                        const poll = await axios.get(prediction.urls.get, {
                            headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` }
                        });
                        prediction = poll.data;
                        pollAttempts++;
                    }

                    if (prediction.status === 'succeeded') {
                        videoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
                        usedModel = `Replicate (${model.name})`;
                        break;
                    }
                } catch (e) {
                    console.error(`[aiartvideo] Replicate ${model.name} failed:`, e.message);
                }
            }

            // --- STAGE 2: PREXZY API (Async Polling) ---
            if (!videoUrl) {
                try {
                    console.log(`[aiartvideo] Trying Prexzy API...`);
                    const submitRes = await axios.get(`https://prexzyapis.com/ai/aiart-video?prompt=${encodeURIComponent(prompt)}&engine=wan2_2`, { timeout: 20000 });
                    const submitData = submitRes.data;

                    if (submitData.status && submitData.task_id) {
                        const taskId = submitData.task_id;
                        const deviceId = submitData.device_id;
                        let pollAttempts = 0;
                        
                        while (pollAttempts < 40) {
                            await new Promise(r => setTimeout(r, 5000));
                            const statusRes = await axios.get(`https://prexzyapis.com/ai/aiart-video-status?task_id=${taskId}&device_id=${deviceId}`, { timeout: 15000 });
                            const statusData = statusRes.data;

                            if (statusData.status && (statusData.state === 'completed' || statusData.video_url)) {
                                videoUrl = statusData.video_url;
                                usedModel = 'Prexzy (Wan 2.2)';
                                break;
                            } else if (statusData.state === 'failed') {
                                break;
                            }
                            pollAttempts++;
                        }
                    }
                } catch (e) {
                    console.error(`[aiartvideo] Prexzy API failed:`, e.message);
                }
            }

            // --- STAGE 3: PUBLIC API FALLBACKS (Sync) ---
            if (!videoUrl) {
                const syncFallbacks = [
                    { name: 'Maher AI', url: `https://api.maher-zubair.tech/ai/text2video?q=${encodeURIComponent(prompt)}` },
                    { name: 'Siputzx AI', url: `https://api.siputzx.my.id/api/ai/text2video?prompt=${encodeURIComponent(prompt)}` }
                ];

                for (const fallback of syncFallbacks) {
                    try {
                        console.log(`[aiartvideo] Trying Sync Fallback: ${fallback.name}`);
                        const res = await axios.get(fallback.url, { timeout: 45000 });
                        videoUrl = res.data.result || res.data.url || res.data.video;
                        if (videoUrl) {
                            usedModel = fallback.name;
                            break;
                        }
                    } catch (e) {
                        console.error(`[aiartvideo] Sync Fallback ${fallback.name} failed:`, e.message);
                    }
                }
            }

            // --- FINAL DELIVERY ---
            if (!videoUrl) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return reply('❌ *ERROR:* All video generation engines (Replicate, Prexzy, and Public) are currently unavailable.\n\nPossible reasons:\n1. Prompt violates safety filters.\n2. API limits reached.\n3. Servers are down.');
            }

            await sock.sendMessage(from, {
                video: { url: videoUrl },
                mimetype: 'video/mp4',
                caption: `🎬 *AI ART VIDEO*\n\n📝 *Prompt:* ${prompt}\n🚀 *Engine:* ${usedModel}\n\n> Generated by SUKUNA MD`,
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('[aiartvideo] Fatal:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            reply('❌ *FATAL ERROR:* The command encountered an unexpected error. Please try again later.');
        }
    }
};
