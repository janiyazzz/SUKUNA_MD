#!/usr/bin/env node
// Load .env if present (no hard dependency)
try { require('dotenv').config(); } catch {}

/**
 * SUKUNA MD v3 — Panel-Paired WhatsApp Bot
 * Entry Point
 *
 * Deploy on a panel (Pterodactyl / VPS). On first boot the console will
 * prompt for a WhatsApp number and print an 8-character pairing code.
 * Enter that code inside WhatsApp → Linked devices → Link with phone
 * number. Sessions persist in ./sessions and auto-reconnect on restart.
 */

const readline       = require('readline');
const chalk          = require('chalk');
const commandLoader  = require('./utils/commandLoader');
const config         = require('./config');
const sessionManager = require('./lib/sessionManager');

console.log(chalk.red(`
╔════════════════════════════════════════════════════════════════╗
║                         SUKUNA MD v3.0                         ║
║              Panel-Paired Multi-User WhatsApp Bot              ║
╚════════════════════════════════════════════════════════════════╝
`));

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}

async function pairFlow() {
    while (true) {
        const raw = await ask(chalk.cyan('\n[PAIR] Enter WhatsApp number with country code (e.g. 2349127857212), or blank to skip: '));
        if (!raw) return;
        const number = raw.replace(/[^0-9]/g, '');
        if (number.length < 8) { console.log(chalk.red('[PAIR] Invalid number, try again.')); continue; }

        console.log(chalk.yellow(`[PAIR] Requesting pairing code for ${number}...`));
        const result = await sessionManager.createSession(number);
        if (!result.success) {
            console.log(chalk.red(`[PAIR] Failed: ${result.error}`));
            continue;
        }
        if (result.code) {
            console.log(chalk.green.bold(`\n[PAIR] Your pairing code: ${result.code}`));
            console.log(chalk.cyan('[PAIR] Open WhatsApp → Linked Devices → Link with phone number → enter the code above.\n'));
        } else {
            console.log(chalk.green(`[PAIR] ${number} is already linked.`));
        }

        const more = await ask(chalk.cyan('[PAIR] Pair another number? (y/N): '));
        if (more.toLowerCase() !== 'y') return;
    }
}

async function main() {
    console.log(chalk.yellow('[SYSTEM] Loading commands...'));
    commandLoader.loadCommands();
    console.log(chalk.green('[SYSTEM] Commands loaded!'));

    console.log(chalk.yellow('[SYSTEM] Restoring existing sessions...'));
    await sessionManager.loadExistingSessions();

    const active = (sessionManager.sessions && sessionManager.sessions.size) || 0;
    console.log(chalk.green(`[SYSTEM] ${active} session(s) restored.`));

    // Auto-pair using config.pairNumber (or PAIR_NUMBER env override)
    const pairNumberRaw = (process.env.PAIR_NUMBER || config.pairNumber || '').toString();
    const pairNumber = pairNumberRaw.replace(/[^0-9]/g, '');

    if (pairNumber && pairNumber.length >= 8) {
        const alreadyLinked = sessionManager.sessions && sessionManager.sessions.has(pairNumber);
        if (alreadyLinked) {
            console.log(chalk.green(`[PAIR] ${pairNumber} is already linked. Skipping pairing.`));
        } else {
            console.log(chalk.yellow(`[PAIR] Auto-pairing ${pairNumber} from config.js...`));
            const result = await sessionManager.createSession(pairNumber);
            if (result.code) {
                console.log(chalk.green.bold(`\n[PAIR] ╔══════════════════════════════════════╗`));
                console.log(chalk.green.bold(`[PAIR] ║  PAIRING CODE: ${result.code}            `));
                console.log(chalk.green.bold(`[PAIR] ╚══════════════════════════════════════╝\n`));
                console.log(chalk.cyan('[PAIR] Open WhatsApp → Linked Devices → Link with phone number → enter the code above.\n'));
            } else if (!result.success) {
                console.log(chalk.red(`[PAIR] Failed: ${result.error}`));
            } else {
                console.log(chalk.green(`[PAIR] ${pairNumber} is already linked.`));
            }
        }
    } else if (process.stdin.isTTY) {
        console.log(chalk.cyan('[INFO] No pairNumber set in config.js → falling back to interactive prompt.'));
        await pairFlow();
    } else {
        console.log(chalk.cyan('[INFO] No pairNumber in config.js and no TTY. Set config.pairNumber or PAIR_NUMBER env var.'));
    }

    console.log(chalk.green('\n[SYSTEM] SUKUNA MD is running. Press Ctrl+C to stop.\n'));
}

main().catch((err) => {
    console.error(chalk.red('[ERROR] Fatal startup error:'), err.message);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error(chalk.red('[ERROR] Uncaught Exception:'), err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('[ERROR] Unhandled Rejection:'), reason);
});
process.on('SIGINT',  () => { console.log(chalk.red('\n[SYSTEM] Shutting down...')); process.exit(0); });
process.on('SIGTERM', () => { console.log(chalk.red('\n[SYSTEM] Shutting down...')); process.exit(0); });
