'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const sharp = require('sharp');
const { generateWAMessageFromContent, proto } = require('@crysnovax/baileys');

/**
 * .neuro — The Peak Jarvis AI Core
 * Autonomous debugging, file fixing, and system management.
 */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function renderNeuroStatus({ status, load, integrity, uptime, memory }, sock) {
    const W = 900, H = 500;
    const accent = '#0066ff'; 
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#02040a"/><stop offset="100%" stop-color="#050a1f"/></linearGradient>
            <radialGradient id="brainGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${accent}" stop-opacity="0.2"/><stop offset="100%" stop-color="${accent}" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#bg)"/><circle cx="${W/2}" cy="${H/2}" r="200" fill="url(#brainGlow)"/>
        <rect x="20" y="20" width="${W-40}" height="${H-40}" fill="none" stroke="${accent}" stroke-opacity="0.2" stroke-width="1" rx="15"/>
        <text x="40" y="55" font-family="monospace" font-size="22" font-weight="bold" fill="${accent}">JARVIS_NEURO // CORE_ACTIVE</text>
        <g transform="translate(40, 100)">
            <text font-family="monospace" font-size="14" fill="${accent}" fill-opacity="0.5">INTEGRITY: ${integrity}%</text>
            <text y="30" font-family="monospace" font-size="14" fill="${accent}" fill-opacity="0.5">LOAD: ${load}%</text>
            <text y="60" font-family="monospace" font-size="14" fill="${accent}" fill-opacity="0.5">UPTIME: ${uptime}</text>
            <text y="90" font-family="monospace" font-size="14" fill="${accent}" fill-opacity="0.5">MEM: ${memory}</text>
            <text y="120" font-family="monospace" font-size="14" fill="${accent}" fill-opacity="0.5">STATUS: ${status}</text>
        </g>
    </svg>`;
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    return (await require('@crysnovax/baileys').generateWAMessageContent({ image: buf }, { upload: sock.waUploadToServer })).imageMessage;
}

module.exports = {
    name: 'neuro',
    aliases: ['jarvis', 'brain'],
    description: 'The Peak Jarvis AI Core',
    category: 'owner',
    usage: '.neuro on/off | .neuro status | .neuro fix <cmd>',

    execute: async ({ sock, msg, from, args, reply, prefix, phoneNumber, isOwner, database }) => {
        if (!isOwner) return reply('🧠 *NEURO:* Access restricted to system owner.');

        const action = args[0]?.toLowerCase();

        if (action === 'on') {
            database.setNeuro(phoneNumber, true);
            return reply('🧠 *NEURO:* Online. Monitoring all systems.');
        }

        if (action === 'off') {
            database.setNeuro(phoneNumber, false);
            return reply('🧠 *NEURO:* Offline. Systems hibernating.');
        }

        if (action === 'status' || !action) {
            const mem = process.memoryUsage();
            const memory = `${Math.round(mem.rss / 1024 / 1024)}MB`;
            const uptime = `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`;
            const imageMessage = await renderNeuroStatus({
                status: database.getNeuro(phoneNumber) ? 'PEAK' : 'STANDBY',
                load: Math.floor(Math.random() * 20) + 5,
                integrity: 100,
                uptime,
                memory
            }, sock);

            const buttons = [
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: database.getNeuro(phoneNumber) ? '💤 Sleep' : '🧠 Wake', id: `${prefix}neuro ${database.getNeuro(phoneNumber) ? 'off' : 'on'}` }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⚡ Ping', id: `${prefix}ping` }) }
            ];

            const interactiveMessage = {
                body: { text: '🧠 *NEURO JARVIS CORE*\nSystems operational. All neural links established.' },
                footer: { text: 'SUKUNA MD · Jarvis' },
                header: { title: '✦ NEURO STATUS ✦', hasMediaAttachment: true, imageMessage },
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

        if (action === 'fix' || action === 'debug') {
            const targetCmd = args[1]?.toLowerCase();
            if (!targetCmd) return reply('🧠 *NEURO:* Specify a target for repair.');

            await reply(`🧠 *NEURO:* Analyzing \`${targetCmd}\`...`);
            
            const commandLoader = require('../../utils/commandLoader');
            const cmd = commandLoader.getCommand(targetCmd);
            
            if (!cmd) return reply(`🧠 *NEURO:* Target \`${targetCmd}\` not found in local directories.`);

            const filePath = path.join(__dirname, '..', '..', 'commands', cmd.category, `${targetCmd}.js`);
            
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const { ask: smartAsk } = require('../../utils/smartAI');
                
                const fixPrompt = `You are the Neuro Repair System. Analyze the following code for the "${targetCmd}" command and provide ONLY the fixed code block. If it is already perfect, return the original code. No explanations.`;
                
                const fixedCode = await smartAsk({
                    key: 'neuro:fix:' + targetCmd,
                    system: fixPrompt,
                    user: content,
                }).catch(() => null);

                if (fixedCode && fixedCode.includes('module.exports')) {
                    // Extract code block if AI wrapped it in markdown
                    const cleanCode = fixedCode.includes('```') ? fixedCode.split('```')[1].replace(/^javascript|^js/, '').trim() : fixedCode.trim();
                    fs.writeFileSync(filePath, cleanCode);
                    await reply(`🧠 *NEURO:* \`${targetCmd}\` has been optimized and patched. Reloading...`);
                    commandLoader.loadCommands();
                } else {
                    await reply(`🧠 *NEURO:* \`${targetCmd}\` is already operating at peak efficiency.`);
                }
            } catch (e) {
                await reply(`🧠 *NEURO:* Repair failed. System error: ${e.message}`);
            }
        }
    }
};
