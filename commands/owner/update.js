/**
 * Update Command — Pull latest code from GitHub and hot-reload the bot.
 *
 * Usage (owner only):
 *   .update          → fetch + fast-forward, npm install if deps changed, hot reload
 *   .update check    → show current vs remote commit, no changes applied
 *   .update force    → discard local changes, hard reset to origin/main
 *   .update restart  → run .update then exit (panel/PM2 auto-restarts)
 *
 * Repo: https://github.com/pasquawisdom2007-beep/SUKUNA_MD.git
 *
 * Safe by design:
 *   - Owner-only via category gate (sessionManager enforces).
 *   - Module-level lock prevents concurrent runs.
 *   - Every shell call is wrapped; failures are reported, never crash the bot.
 *   - Preserves runtime data: sessions/, data/, .env, node_modules/.
 *   - Auto-detects git vs tarball mode (works even if .git is missing).
 *   - Hot-reloads commands via commandLoader (no restart needed for command changes).
 *   - Flags index.js / lib/* / config.js changes as restart-required.
 */

const fs            = require('fs');
const path          = require('path');
const https         = require('https');
const zlib          = require('zlib');
const { exec }      = require('child_process');
const { promisify } = require('util');
const execAsync     = promisify(exec);

const commandLoader = require('../../utils/commandLoader');

const REPO_URL      = 'https://github.com/pasquawisdom2007-beep/SUKUNA_MD.git';
const REPO_OWNER    = 'pasquawisdom2007-beep';
const REPO_NAME     = 'SUKUNA_MD';
const REPO_BRANCH   = 'main';
const TARBALL_URL   = `https://codeload.github.com/${REPO_OWNER}/${REPO_NAME}/tar.gz/refs/heads/${REPO_BRANCH}`;

const REPO_ROOT     = path.resolve(__dirname, '..', '..');

// Files/dirs that must never be overwritten by an update.
const PRESERVE = new Set([
    'sessions',
    'data',
    'node_modules',
    '.env',
    '.env.local',
    'package-lock.json',
    'bun.lock',
]);

// Files where a change means a restart is strongly recommended.
const RESTART_REQUIRED_PATHS = [
    'index.js',
    'config.js',
    'lib/',
];

let UPDATE_IN_PROGRESS = false;

// ── helpers ─────────────────────────────────────────────────────────────────
async function run(cmd, opts = {}) {
    return execAsync(cmd, {
        cwd: REPO_ROOT,
        timeout: opts.timeout || 120000,
        maxBuffer: 10 * 1024 * 1024,
        env: process.env,
        ...opts,
    });
}

async function hasGit() {
    try {
        if (!fs.existsSync(path.join(REPO_ROOT, '.git'))) return false;
        await run('git --version', { timeout: 5000 });
        return true;
    } catch { return false; }
}

async function gitShortSha(ref = 'HEAD') {
    try {
        const { stdout } = await run(`git rev-parse --short ${ref}`);
        return stdout.trim();
    } catch { return 'unknown'; }
}

async function gitCommitSubject(ref = 'HEAD') {
    try {
        const { stdout } = await run(`git log -1 --pretty=%s ${ref}`);
        return stdout.trim();
    } catch { return ''; }
}

async function gitChangedFiles(from, to) {
    try {
        const { stdout } = await run(`git diff --name-only ${from} ${to}`);
        return stdout.split('\n').map(s => s.trim()).filter(Boolean);
    } catch { return []; }
}

async function ensureRemote() {
    try {
        await run('git remote get-url origin', { timeout: 5000 });
    } catch {
        await run(`git remote add origin ${REPO_URL}`);
    }
}

function needsRestart(changed) {
    return changed.some(f =>
        RESTART_REQUIRED_PATHS.some(p => p.endsWith('/') ? f.startsWith(p) : f === p)
    );
}

function needsInstall(changed) {
    return changed.some(f => f === 'package.json' || f === 'package-lock.json' || f === 'bun.lock');
}

function trim(text, max = 1500) {
    if (!text) return '';
    const s = String(text);
    return s.length > max ? s.slice(0, max) + '\n…(truncated)' : s;
}

// ── tarball fallback (used when .git is missing) ────────────────────────────
function download(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'SUKUNA-MD-Updater' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(download(res.headers.location));
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} from ${url}`));
                return;
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(120000, () => req.destroy(new Error('Download timeout')));
    });
}

async function tarballUpdate() {
    // Requires `tar` CLI; ubiquitous on Linux panels/VPS.
    try { await run('tar --version', { timeout: 5000 }); }
    catch { throw new Error('tar CLI not available and .git directory missing. Initialize git: cd ' + REPO_ROOT + ' && git init && git remote add origin ' + REPO_URL + ' && git fetch && git reset --hard origin/' + REPO_BRANCH); }

    const tmpDir = path.join(REPO_ROOT, '.update-tmp');
    const tarPath = path.join(tmpDir, 'src.tar.gz');
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    const gz = await download(TARBALL_URL);
    const tar = zlib.gunzipSync(gz);
    fs.writeFileSync(tarPath.replace(/\.gz$/, ''), tar);

    await run(`tar -xf "${tarPath.replace(/\.gz$/, '')}" -C "${tmpDir}"`);
    // Extracted top-level dir: SUKUNA_MD-main
    const extractedRoot = path.join(tmpDir, `${REPO_NAME}-${REPO_BRANCH}`);
    if (!fs.existsSync(extractedRoot)) {
        throw new Error('Tarball did not contain expected directory ' + `${REPO_NAME}-${REPO_BRANCH}`);
    }

    const changed = [];
    function copyRecursive(srcDir, dstDir, relBase = '') {
        for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
            const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
            if (PRESERVE.has(rel.split('/')[0])) continue;
            const src = path.join(srcDir, entry.name);
            const dst = path.join(dstDir, entry.name);
            if (entry.isDirectory()) {
                if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
                copyRecursive(src, dst, rel);
            } else if (entry.isFile()) {
                let differs = true;
                try {
                    if (fs.existsSync(dst)) {
                        const a = fs.readFileSync(src);
                        const b = fs.readFileSync(dst);
                        differs = !a.equals(b);
                    }
                } catch { differs = true; }
                if (differs) {
                    fs.copyFileSync(src, dst);
                    changed.push(rel);
                }
            }
        }
    }
    copyRecursive(extractedRoot, REPO_ROOT);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return changed;
}

// ── main command ────────────────────────────────────────────────────────────
module.exports = {
    name: 'update',
    aliases: ['pullupdate', 'gitpull', 'sync'],
    description: 'Pull latest code from GitHub and hot-reload commands (owner only)',
    category: 'owner',
    ownerOnly: true,

    async execute({ reply, args }) {
        const mode = (args[0] || '').toLowerCase();

        if (UPDATE_IN_PROGRESS) {
            return reply('⏳ An update is already in progress. Please wait for it to finish.');
        }
        UPDATE_IN_PROGRESS = true;

        const started = Date.now();
        try {
            await reply('🔄 *Checking for updates…*\n_Source: ' + REPO_URL + '_');

            const usingGit = await hasGit();

            // ── CHECK MODE ──
            if (mode === 'check') {
                if (!usingGit) {
                    return reply('ℹ️ No `.git` directory found. Running `.update` will use the tarball fallback.\nRepo: ' + REPO_URL);
                }
                await ensureRemote();
                await run(`git fetch origin ${REPO_BRANCH}`);
                const local  = await gitShortSha('HEAD');
                const remote = await gitShortSha(`origin/${REPO_BRANCH}`);
                const subj   = await gitCommitSubject(`origin/${REPO_BRANCH}`);
                if (local === remote) {
                    return reply(`✅ *Already up to date.*\nCommit: \`${local}\``);
                }
                const changed = await gitChangedFiles('HEAD', `origin/${REPO_BRANCH}`);
                return reply(
                    `🆕 *Update available*\n\n` +
                    `• Local:  \`${local}\`\n` +
                    `• Remote: \`${remote}\` — ${subj || '(no message)'}\n` +
                    `• Files changed: ${changed.length}\n\n` +
                    `Run \`.update\` to apply, or \`.update restart\` to apply + restart.`
                );
            }

            let oldSha = 'n/a', newSha = 'n/a', subject = '', changed = [];
            let usedTarball = false;

            // ── GIT MODE ──
            if (usingGit) {
                await ensureRemote();
                await run(`git fetch origin ${REPO_BRANCH}`);
                oldSha = await gitShortSha('HEAD');
                const remoteSha = await gitShortSha(`origin/${REPO_BRANCH}`);

                if (oldSha === remoteSha && mode !== 'force') {
                    UPDATE_IN_PROGRESS = false;
                    return reply(`✅ *Already up to date.*\nCommit: \`${oldSha}\``);
                }

                if (mode === 'force') {
                    await run(`git reset --hard origin/${REPO_BRANCH}`);
                } else {
                    try {
                        await run(`git pull --ff-only origin ${REPO_BRANCH}`);
                    } catch (err) {
                        UPDATE_IN_PROGRESS = false;
                        return reply(
                            '❌ *Git pull failed* (likely local changes).\n\n```' +
                            trim(err.stderr || err.message, 800) + '```\n\n' +
                            'Try `.update force` to discard local changes and hard-reset to origin/' + REPO_BRANCH + '.'
                        );
                    }
                }

                newSha  = await gitShortSha('HEAD');
                subject = await gitCommitSubject('HEAD');
                changed = oldSha !== 'unknown'
                    ? await gitChangedFiles(oldSha, newSha)
                    : [];
            } else {
                // ── TARBALL MODE ──
                await reply('ℹ️ No `.git` found — using tarball fallback.');
                changed = await tarballUpdate();
                usedTarball = true;
                newSha = 'tarball';
            }

            // ── Install deps if needed ──
            let installInfo = 'skipped';
            if (needsInstall(changed)) {
                await reply('📦 *Installing updated dependencies…* (this can take a minute)');
                const t0 = Date.now();
                try {
                    await run('npm install --omit=dev --no-audit --no-fund', { timeout: 4 * 60 * 1000 });
                    installInfo = `ran (${((Date.now() - t0) / 1000).toFixed(1)}s)`;
                } catch (err) {
                    installInfo = 'FAILED — ' + trim(err.stderr || err.message, 400);
                }
            }

            // ── Hot reload commands ──
            let reloadedCount = 0;
            let reloadError = null;
            try {
                commandLoader.commands = new Map();
                commandLoader.aliases  = new Map();
                commandLoader.loadCommands();
                reloadedCount = commandLoader.commands.size;
            } catch (err) {
                reloadError = err.message;
            }

            const restart = needsRestart(changed);
            const elapsed = ((Date.now() - started) / 1000).toFixed(1);

            const summary =
                '✅ *Update complete* (' + elapsed + 's)\n\n' +
                (usedTarball
                    ? '• Mode: tarball (no git)\n'
                    : `• From: \`${oldSha}\`\n• To:   \`${newSha}\`` + (subject ? ` — ${subject}` : '') + '\n') +
                `• Files changed: ${changed.length}` + (changed.length ? `\n  ${changed.slice(0, 12).map(f => '— ' + f).join('\n  ')}` + (changed.length > 12 ? `\n  …+${changed.length - 12} more` : '') : '') + '\n' +
                `• npm install: ${installInfo}\n` +
                `• Commands reloaded: ${reloadError ? '❌ ' + reloadError : reloadedCount}\n` +
                `• Restart required: ${restart ? '⚠️ YES (core files changed)' : 'no'}`;

            await reply(summary);

            if (mode === 'restart' || restart) {
                await reply(restart && mode !== 'restart'
                    ? '⚠️ Core files changed — restarting in 3s so changes take effect…'
                    : '🔄 Restarting in 3s…');
                setTimeout(() => {
                    console.log('[UPDATE] Restart triggered after update.');
                    process.exit(0);
                }, 3000);
            }
        } catch (err) {
            try {
                await reply('❌ *Update failed*\n\n```' + trim(err.stderr || err.message || String(err), 1500) + '```');
            } catch {}
            console.error('[UPDATE] Error:', err);
        } finally {
            UPDATE_IN_PROGRESS = false;
        }
    },
};
