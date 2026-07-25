'use strict';

const axios = require('axios');

module.exports = {
    name: 'nexus',
    aliases: ['portal', 'browse', 'sky'],
    description: 'The Reality Portal — Virtual Browser & Flight Tracking',
    usage: '.nexus browse <url> | .nexus sky',
    category: 'media',

    async execute({ sock, msg, from, args, reply }) {
        const subCommand = args[0]?.toLowerCase();

        if (!subCommand) {
            return reply(`🌐 *NEXUS PORTAL* 🌐\n\n*Commands:*\n1. \`.nexus browse <url>\` — Open a virtual window to any website.\n2. \`.nexus sky\` — Real-time flight tracking of aircraft above.`);
        }

        if (subCommand === 'browse') {
            const url = args[1];
            if (!url) return reply('❌ Please provide a URL (e.g., .nexus browse google.com)');
            
            const targetUrl = url.startsWith('http') ? url : `https://${url}`;
            await sock.sendMessage(from, { react: { text: '🌐', key: msg.key } });
            await reply('🌀 *Opening Reality Portal...*');

            try {
                // Using Microlink as a free, high-quality rendering engine
                const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&screenshot=true&meta=false&embed=screenshot.url`;
                
                await sock.sendMessage(from, {
                    image: { url: screenshotUrl },
                    caption: `🌐 *NEXUS BROWSER*\n\n*URL:* ${targetUrl}\n*Status:* Live Rendered\n\n_Note: This is a static snapshot of the live site._`
                }, { quoted: msg });
                
                await sock.sendMessage(from, { react: { text: '✨', key: msg.key } });
            } catch (e) {
                console.error(e);
                reply('❌ Portal collapsed: Failed to render the website.');
            }
        } 
        else if (subCommand === 'sky' || subCommand === 'flight') {
            await sock.sendMessage(from, { react: { text: '✈️', key: msg.key } });
            await reply('🛰️ *Intercepting Satellite Data...*');

            try {
                // Using OpenSky Network API (Free, No Key)
                // We'll fetch global states and filter for a few interesting ones or just show the top ones
                const res = await axios.get('https://opensky-network.org/api/states/all', { timeout: 15000 });
                const states = res.data?.states || [];
                
                if (states.length === 0) return reply('❌ No active flight data found in the atmosphere.');

                // Take top 10 flights for the report
                const topFlights = states.slice(0, 10);
                
                let report = `🛰️ *GOD-EYE SURVEILLANCE*\n\n`;
                report += `Total Flights Tracked: ${states.length}\n\n`;
                
                topFlights.forEach((f, i) => {
                    const callsign = f[1] ? f[1].trim() : 'UNKNOWN';
                    const country = f[2] || 'Unknown';
                    const altitude = f[7] ? `${Math.round(f[7])}m` : 'N/A';
                    const velocity = f[9] ? `${Math.round(f[9] * 3.6)}km/h` : 'N/A';
                    
                    report += `${i + 1}. ✈️ *${callsign}*\n`;
                    report += `   🌍 Origin: ${country}\n`;
                    report += `   📏 Altitude: ${altitude}\n`;
                    report += `   🚀 Speed: ${velocity}\n\n`;
                });
                
                report += `_Showing top 10 global active flights._`;

                await sock.sendMessage(from, {
                    text: report,
                    contextInfo: {
                        externalAdReply: {
                            title: 'LIVE FLIGHT RADAR',
                            body: 'Global Air Traffic Surveillance',
                            thumbnailUrl: 'https://cdn-icons-png.flaticon.com/512/784/784850.png',
                            sourceUrl: 'https://opensky-network.org',
                            mediaType: 1
                        }
                    }
                }, { quoted: msg });
                
                await sock.sendMessage(from, { react: { text: '📡', key: msg.key } });
            } catch (e) {
                console.error(e);
                reply('❌ Satellite link lost: Failed to retrieve flight data.');
            }
        }
        else {
            reply('❌ Unknown Nexus command. Use `.nexus` to see options.');
        }
    }
};
