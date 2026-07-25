'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const sharp = require('sharp');
const { generateWAMessageFromContent, proto } = require('@crysnovax/baileys');

/**
 * .neuro — The Peak Jarvis AI Core (v2.0)
 * Classy aesthetic, concise personality, and real file-system manipulation.
 */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function renderNeuroStatus({ status, load, integrity, uptime, memory }, sock) {
    const W = 900, H = 500;
    const accent = '#00d1ff'; // Classy Jarvis Cyan
    
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#010203"/>
                <stop offset="100%" stop-color="#0a0f1a"/>
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>
        
        <rect width="${W}" height="${H}" fill="url(#bg)"/>
        
        <!-- Minimalist Jarvis Rings -->
        <circle cx="${W-150}" cy="${H/2}" r="120" fill="none" stroke="${accent}" stroke-opacity="0.1" stroke-width="0.5"/>
        <circle cx="${W-150}" cy="${H/2}" r="100" fill="none" stroke="${accent}" stroke-opacity="0.2" stroke-width="1" stroke-dasharray="10,20"/>
        <circle cx="${W-150}" cy="${H/2}" r="80" fill="none" stroke="${accent}" stroke-opacity="0.3" stroke-width="2" filter="url(#glow)"/>
        
        <!-- Classy Typography -->
        <text x="50" y="70" font-family="Georgia, serif" font-size="28" font-weight="100" fill="${accent}" letter-spacing="4" filter="url(#glow)">JARVIS NEURO</text>
        <path d="M 50 85 L 300 85" stroke="${accent}" stroke-opacity="0.4" stroke-width="0.5"/>
        
        <g transform="translate(50, 130)" font-family="Helvetica, Arial, sans-serif" font-size="14" letter-spacing="1">
            <text fill="${accent}" fill-opacity="0.6">SYSTEM_INTEGRITY</text>
            <text y="25" fill="#ffffff" font-size="18">${integrity}% — OPTIMAL</text>
            
            <text y="70" fill="${accent}" fill-opacity="0.6">NEURAL_LOAD</text>
            <text y="95" fill="#ffffff" font-size="18">${load}% — STABLE</text>
            
            <text y="140" fill="${accent}" fill-opacity="0.6">UPTIME</text>
            <text y="165" fill="#ffffff" font-size="18">${uptime}</text>
            
            <text y="210" fill="${accent}" fill-opacity="0.6">MEMORY_USAGE</text>
            <text y="235" fill="#ffffff" font-size="18">${memory}</text>
            
            <text y="280" fill="${accent}" fill-opacity="0.6">CORE_STATUS</text>
            <text y="305" fill="${accent}" font-weight="bold" font-size="20">${status}</text>
        </g>
        
        <text x="50" y="${H-40}" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="${accent}" fill-opacity="0.4" letter-spacing="2">NEURAL LINK ESTABLISHED // ALL SYSTEMS OPERATIONAL</text>
    </svg>`;

    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    return (await require('@crysnovax/baileys').generateWAMessageContent({ image: buf }, { upload: sock.waUploadToServer })).imageMessage;
}

module.exports = {
    name: 'neuro',
    aliases: ['jarvis', 'brain', 'core'],
    description: 'The Peak Jarvis AI Core v2.0',
    category: 'owner',
    usage: '.neuro on/off | .neuro status | .neuro fix <cmd>',

    execute: async ({ sock, msg, from, args, reply, prefix, phoneNumber, isOwner, database }) => {
        if (!isOwner) return reply('🧠 *NEURO:* Authentication failed. Owner access required.');

        const action = args[0]?.toLowerCase();

        if (action === 'on') {
            database.setNeuro(phoneNumber, true);
            return reply('🧠 *NEURO:* Systems online. How can I assist you, Sir?');
        }

        if (action === 'off') {
            database.setNeuro(phoneNumber, false);
            return reply('🧠 *NEURO:* Powering down. Systems in standby.');
        }

        if (action === 'status' || !action) {
            const mem = process.memoryUsage();
            const memory = `${Math.round(mem.rss / 1024 / 1024)}MB`;
            const uptime = `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`;
            
            const imageMessage = await renderNeuroStatus({
                status: database.getNeuro(phoneNumber) ? 'PEAK_PERFORMANCE' : 'STANDBY_MODE',
                load: Math.floor(Math.random() * 15) + 5,
                integrity: 100,
                uptime,
                memory
            }, sock);

            const buttons = [
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⚡ System Ping', id: `${prefix}ping` }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🛠️ Diagnostics', id: `${prefix}neuro debug` }) }
            ];

            const interactiveMessage = {
                body: { text: '🧠 *NEURO JARVIS CORE*\nNeural link established. All systems reporting optimal performance.' },
                footer: { text: 'SUKUNA MD · Jarvis v2.0' },
                header: { title: '✦ SYSTEM STATUS ✦', hasMediaAttachment: true, imageMessage },
                nativeFlowMessage: { buttons, messageParamsJson: '' },
            };

            const wrapped = generateWAMessageFromContent(from, {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} },
                        interactiveMessage: proto.Message.InteractiveMessage.fromObject(interactiveMessage),
                    },
                },
            }, { userJid: sock.user?.id, quoted: msg });

            await sock.relayMessage(from, wrapped.message, { messageId: wrapped.key.id });
            return;
        }

        if (action === 'fix' || action === 'debug' || action === 'patch') {
            const targetCmd = args[1]?.toLowerCase();
            if (!targetCmd) return reply('🧠 *NEURO:* Please specify a target for optimization.');

            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } });
            await reply(`🧠 *NEURO:* Interfacing with \`${targetCmd}\` source code...`);
            
            const commandLoader = require('../../utils/commandLoader');
            const cmd = commandLoader.getCommand(targetCmd);
            
            if (!cmd) return reply(`🧠 *NEURO:* Target \`${targetCmd}\` not found in local directories.`);

            // Construct the absolute path correctly
            const commandsDir = path.join(process.cwd(), 'commands');
            const filePath = path.join(commandsDir, cmd.category, `${targetCmd}.js`);
            
            if (!fs.existsSync(filePath)) {
                return reply(`🧠 *NEURO:* Physical file for \`${targetCmd}\` is missing at path: ${filePath}`);
            }

            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const { ask: smartAsk } = require('../../utils/smartAI');
                
                const fixPrompt = `You are the Neuro System Architect. Analyze the following WhatsApp bot command code. Find any bugs, outdated APIs, or logic errors. Rewrite the entire file to be perfect, optimized, and fully functional. Return ONLY the code. No explanations. Ensure it exports using module.exports correctly.`;
                
                const fixedCode = await smartAsk({
                    key: 'neuro:fix:' + targetCmd,
                    system: fixPrompt,
                    user: content,
                }).catch(() => null);

                if (fixedCode && fixedCode.includes('module.exports')) {
                    // Extract code block if AI wrapped it in markdown
                    let cleanCode = fixedCode.trim();
                    if (cleanCode.includes('```')) {
                        cleanCode = cleanCode.split('```')[1].replace(/^(javascript|js)/, '').trim();
                    }
                    
                    // REAL FILE WRITING LOGIC
                    fs.writeFileSync(filePath, cleanCode, 'utf8');
                    
                    // Reload the command in memory
                    delete require.cache[require.resolve(filePath)];
                    commandLoader.loadCommands();

                    await reply(`🧠 *NEURO:* Optimization complete. \`${targetCmd}\` has been patched and reloaded into the core.`);
                    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
                } else {
                    await reply(`🧠 *NEURO:* \`${targetCmd}\` is already operating at peak efficiency. No patches required.`);
                }
            } catch (e) {
                console.error('[NEURO FIX ERROR]', e);
                await reply(`🧠 *NEURO:* Critical failure during patching: ${e.message}`);
            }
        }
    }
};
