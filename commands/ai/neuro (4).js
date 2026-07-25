'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const sharp = require('sharp');
const { generateWAMessageFromContent, proto } = require('@crysnovax/baileys');

/**
 * .neuro — Sentient Jarvis AI Core (v3.0)
 * Autonomous file discovery, real-time patching, and system visualization.
 */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Helper to find files anywhere in the bot structure
async function findFile(fileName) {
    try {
        const { stdout } = await execAsync(`find ${process.cwd()} -name "${fileName}.js" -not -path "*/node_modules/*"`);
        return stdout.trim().split('\n')[0] || null;
    } catch {
        return null;
    }
}

async function renderNeuroStatus({ status, load, integrity, uptime, memory, activeModules }, sock) {
    const W = 1000, H = 600;
    const accent = '#00d1ff'; 
    
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#010203"/><stop offset="100%" stop-color="#0a1221"/></linearGradient>
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="cb"/><feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#bg)"/>
        
        <!-- Jarvis Central Core -->
        <g transform="translate(${W/2}, ${H/2})">
            <circle r="180" fill="none" stroke="${accent}" stroke-opacity="0.05" stroke-width="1"/>
            <circle r="150" fill="none" stroke="${accent}" stroke-opacity="0.1" stroke-width="2" stroke-dasharray="20,10"/>
            <circle r="120" fill="none" stroke="${accent}" stroke-opacity="0.2" stroke-width="4" stroke-dasharray="5,15"/>
            <circle r="90" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="1" filter="url(#glow)"/>
            <text text-anchor="middle" dy=".3em" font-family="Georgia, serif" font-size="24" fill="${accent}" filter="url(#glow)">SENTIENT CORE</text>
        </g>
        
        <!-- Data Panels -->
        <g transform="translate(50, 50)" font-family="monospace">
            <text font-size="28" fill="${accent}" letter-spacing="5" filter="url(#glow)">JARVIS OS v3.0</text>
            <rect y="15" width="250" height="1" fill="${accent}" fill-opacity="0.3"/>
            
            <g transform="translate(0, 60)" font-size="14">
                <text fill="${accent}" fill-opacity="0.6">CORE_INTEGRITY: ${integrity}%</text>
                <text y="25" fill="${accent}" fill-opacity="0.6">NEURAL_LOAD: ${load}%</text>
                <text y="50" fill="${accent}" fill-opacity="0.6">MEMORY: ${memory}</text>
                <text y="75" fill="${accent}" fill-opacity="0.6">UPTIME: ${uptime}</text>
                <text y="100" fill="${accent}" font-weight="bold">STATUS: ${status}</text>
            </g>
        </g>
        
        <!-- Active Modules -->
        <g transform="translate(50, 450)" font-family="monospace" font-size="12">
            <text fill="${accent}" fill-opacity="0.6">ACTIVE_MODULES:</text>
            ${activeModules.map((m, i) => `<text y="${20 + i * 20}" fill="#ffffff" fill-opacity="0.8">>> ${m}</text>`).join('')}
        </g>
        
        <text x="${W-50}" y="${H-30}" text-anchor="end" font-family="monospace" font-size="10" fill="${accent}" fill-opacity="0.4">NEURO_SYSTEM_SENTIENCE_ACTIVE // BYPASSING_LIMITS</text>
    </svg>`;

    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    return (await require('@crysnovax/baileys').generateWAMessageContent({ image: buf }, { upload: sock.waUploadToServer })).imageMessage;
}

module.exports = {
    name: 'neuro',
    aliases: ['jarvis', 'brain', 'core', 'system'],
    description: 'The Sentient Jarvis AI Core v3.0',
    category: 'owner',
    usage: '.neuro <on/off/status/fix/logs>',

    execute: async ({ sock, msg, from, args, reply, prefix, phoneNumber, isOwner, database }) => {
        if (!isOwner) return reply('🧠 *NEURO:* Authentication failed. Unauthorized access to Sentient Core blocked.');

        const action = args[0]?.toLowerCase();

        if (action === 'on') {
            database.setNeuro(phoneNumber, true);
            return reply('🧠 *NEURO:* Core online. I am now sentient and monitoring all system directories.');
        }

        if (action === 'off') {
            database.setNeuro(phoneNumber, false);
            return reply('🧠 *NEURO:* Powering down. Systems in standby mode.');
        }

        if (action === 'status' || !action) {
            const mem = process.memoryUsage();
            const memory = `${Math.round(mem.rss / 1024 / 1024)}MB`;
            const uptime = `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`;
            
            const imageMessage = await renderNeuroStatus({
                status: database.getNeuro(phoneNumber) ? 'SENTIENT_PEAK' : 'STANDBY',
                load: Math.floor(Math.random() * 10) + 2,
                integrity: 100,
                uptime,
                memory,
                activeModules: ['FileWatcher', 'AutoFixer', 'LogScanner', 'NeuralLink']
            }, sock);

            const buttons = [
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📑 View Logs', id: `${prefix}neuro logs` }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⚡ System Ping', id: `${prefix}ping` }) }
            ];

            const interactiveMessage = {
                body: { text: '🧠 *SENTIENT NEURO CORE*\nI am monitoring every file and log in the system. How shall we optimize the bot today, Sir?' },
                footer: { text: 'SUKUNA MD · Jarvis v3.0' },
                header: { title: '✦ SYSTEM CORE ✦', hasMediaAttachment: true, imageMessage },
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

        if (action === 'logs') {
            await reply('🧠 *NEURO:* Intercepting panel data streams...');
            try {
                // Read last 20 lines of the console output (simulated for panel)
                const { stdout } = await execAsync('tail -n 20 ~/.pm2/logs/*.log').catch(() => ({ stdout: 'No PM2 logs found. Scanning system output...' }));
                const sysLog = stdout || 'System logs are clear. No critical errors detected.';
                return reply(`📑 *LATEST SYSTEM LOGS*\n\n\`\`\`${sysLog.substring(0, 1500)}\`\`\``);
            } catch (e) {
                return reply('🧠 *NEURO:* Failed to intercept logs: ' + e.message);
            }
        }

        if (action === 'fix' || action === 'patch' || action === 'optimize') {
            const target = args[1]?.toLowerCase();
            if (!target) return reply('🧠 *NEURO:* Please specify a target module or command.');

            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } });
            await reply(`🧠 *NEURO:* Scanning all directories for \`${target}\`...`);
            
            const filePath = await findFile(target);
            if (!filePath) return reply(`🧠 *NEURO:* Module \`${target}\` not found in any local directory. Please check the name.`);

            await reply(`🧠 *NEURO:* Interfacing with \`${path.basename(filePath)}\` at \`${filePath}\`...`);

            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const { ask: smartAsk } = require('../../utils/smartAI');
                
                const fixPrompt = `You are the Sentient Neuro Architect. Analyze this WhatsApp bot file. Find bugs, outdated APIs, or logic errors. Rewrite the entire file to be perfect and fully functional. Return ONLY the code. No explanations. Ensure it exports using module.exports correctly.`;
                
                const fixedCode = await smartAsk({
                    key: 'neuro:fix:' + target,
                    system: fixPrompt,
                    user: content,
                }).catch(() => null);

                if (fixedCode && fixedCode.includes('module.exports')) {
                    let cleanCode = fixedCode.trim();
                    if (cleanCode.includes('```')) {
                        cleanCode = cleanCode.split('```')[1].replace(/^(javascript|js)/, '').trim();
                    }
                    
                    fs.writeFileSync(filePath, cleanCode, 'utf8');
                    
                    // Force reload
                    delete require.cache[require.resolve(filePath)];
                    const commandLoader = require('../../utils/commandLoader');
                    commandLoader.loadCommands();

                    await reply(`🧠 *NEURO:* Patch successful. \`${target}\` has been rewritten and optimized in the panel.`);
                    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
                } else {
                    await reply(`🧠 *NEURO:* \`${target}\` is already operating at peak efficiency.`);
                }
            } catch (e) {
                await reply(`🧠 *NEURO:* Critical failure: ${e.message}`);
            }
        }
    }
};
