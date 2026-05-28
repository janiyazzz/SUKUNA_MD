/**
 * TTT — Tic-Tac-Toe with shared lobby + canvas rendering.
 *
 *   .ttt              — open a 30s lobby (anyone can .join / reply "join")
 *   .ttt @player      — direct challenge (skips lobby)
 *   .ttt bot          — solo vs bot
 *   .ttt 1-9          — place your piece on your turn
 *   .ttt board        — show the current canvas board
 *   .ttt quit         — forfeit
 */

'use strict';

const lobbyRegistry = require('../../lib/gameLobby');
const {
    renderTttLobbyCard,
    renderTttBoardCard,
} = require('../../utils/canvasRender');

const LOBBY_MS = 30_000;

const WINS = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
];

function checkWinner(cells) {
    for (const line of WINS) {
        const [a, b, c] = line;
        if (cells[a] && cells[a] === cells[b] && cells[b] === cells[c]) {
            return { mark: cells[a], line };
        }
    }
    return null;
}

function isDraw(cells) {
    return cells.every(c => c !== null) && !checkWinner(cells);
}

function botMove(cells, botMark, playerMark) {
    for (const [a, b, c] of WINS) {
        if (cells[a] === botMark && cells[b] === botMark && cells[c] === null) return c;
        if (cells[a] === botMark && cells[c] === botMark && cells[b] === null) return b;
        if (cells[b] === botMark && cells[c] === botMark && cells[a] === null) return a;
    }
    for (const [a, b, c] of WINS) {
        if (cells[a] === playerMark && cells[b] === playerMark && cells[c] === null) return c;
        if (cells[a] === playerMark && cells[c] === playerMark && cells[b] === null) return b;
        if (cells[b] === playerMark && cells[c] === playerMark && cells[a] === null) return a;
    }
    if (cells[4] === null) return 4;
    const corners = [0, 2, 6, 8].filter(i => cells[i] === null);
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    const open = cells.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
    return open.length ? open[Math.floor(Math.random() * open.length)] : -1;
}

// chatId → game
const games = new Map();

function makeGroupGame(p1, p2, startedBy) {
    return {
        mode: 'group',
        state: 'playing',
        startedBy,
        cells: Array(9).fill(null),
        players: { X: p1, O: p2 },
        turn: 'X',
        _lobbyTimer: null,
    };
}

function makeBotGame(player) {
    return {
        mode: 'bot',
        state: 'playing',
        startedBy: player,
        cells: Array(9).fill(null),
        player,
        pMark: 'X',
        bMark: 'O',
        turn: 'X',
    };
}

async function sendLobbyCard(sock, from, game) {
    const secondsLeft = Math.max(0, Math.ceil((game.lobbyDeadline - Date.now()) / 1000));
    const players = game.players.map(jid => ({ jid }));
    const buf = await renderTttLobbyCard({ players, secondsLeft });
    return sock.sendMessage(from, {
        image: buf,
        caption: `❌⭕ *Tic-Tac-Toe* — type *.join* or reply "*join*" (${players.length}/2). Starts in ${secondsLeft}s.`,
        mentions: game.players,
    });
}

async function sendBoardCard(sock, from, game, header = '', winLine = null) {
    let players;
    if (game.mode === 'group') players = game.players;
    else players = { X: game.player, O: 'bot@bot' };

    const buf = await renderTttBoardCard({
        cells: game.cells,
        players,
        turn: game.turn,
        header,
        winLine,
    });
    const mentions = game.mode === 'group'
        ? Object.values(game.players)
        : [game.player];
    return sock.sendMessage(from, { image: buf, caption: header || 'Tic-Tac-Toe', mentions });
}

async function startGroupFromLobby(sock, from, msg) {
    const lobby = games.get(from);
    if (!lobby || lobby.state !== 'lobby') return;
    if (lobby._lobbyTimer) { clearTimeout(lobby._lobbyTimer); lobby._lobbyTimer = null; }
    if (lobby.players.length < 2) {
        games.delete(from);
        lobbyRegistry.close(from);
        await sock.sendMessage(from, {
            text: `❌ *Tic-Tac-Toe cancelled* — need 2 players.`,
        }, { quoted: msg });
        return;
    }
    const [p1, p2] = lobby.players;
    const game = makeGroupGame(p1, p2, lobby.startedBy);
    games.set(from, game);
    lobbyRegistry.close(from);
    await sendBoardCard(sock, from, game,
        `GAME ON — @${p1.split('@')[0]} vs @${p2.split('@')[0]}`);
}

function registerLobby(sock, from, lobby) {
    lobbyRegistry.open(from, 'ttt', {
        hasPlayer: (jid) => lobby.players.includes(jid),
        isFull:    () => lobby.players.length >= 2,
        addPlayer: async (jid) => {
            if (lobby.state !== 'lobby') return { ok: false, reason: 'closed' };
            if (lobby.players.includes(jid)) return { ok: false, reason: 'already' };
            if (lobby.players.length >= 2) return { ok: false, reason: 'full' };
            lobby.players.push(jid);
            try { await sendLobbyCard(sock, from, lobby); } catch {}
            if (lobby.players.length >= 2) {
                // start immediately
                if (lobby._lobbyTimer) { clearTimeout(lobby._lobbyTimer); lobby._lobbyTimer = null; }
                setTimeout(() => startGroupFromLobby(sock, from, null).catch(e => console.error('[ttt-start]', e.message)), 600);
            }
            return { ok: true, kind: 'ttt' };
        },
    });
}

module.exports = {
    name:        'ttt',
    aliases:     ['tictactoe', 'xo'],
    description: 'Tic-Tac-Toe — multiplayer with .join, or solo vs bot. Canvas board.',
    usage:       '.ttt [@player | bot | 1-9 | board | quit]',
    category:    'fun',

    _games: games,

    async execute({ sock, msg, from, sender, args, reply, isGroup }) {
        const sub  = (args[0] || '').toLowerCase().trim();
        const game = games.get(from);

        // ── BOARD ──────────────────────────────────────────────────────────────
        if (sub === 'board') {
            if (!game || game.state !== 'playing') return reply(`❌ *No active game.* Start with *.ttt*`);
            return await sendBoardCard(sock, from, game, 'Current board');
        }

        // ── QUIT ──────────────────────────────────────────────────────────────
        if (sub === 'quit' || sub === 'forfeit') {
            if (!game) return reply(`❌ *No active game.*`);
            if (game._lobbyTimer) clearTimeout(game._lobbyTimer);
            games.delete(from);
            lobbyRegistry.close(from);
            return await sock.sendMessage(from, {
                text: `🏳️ *@${sender.split('@')[0]} forfeited the game!*`,
                mentions: [sender],
            }, { quoted: msg });
        }

        // ── MOVE 1-9 ──────────────────────────────────────────────────────────
        const pos = parseInt(sub);
        if (pos >= 1 && pos <= 9) {
            if (!game || game.state !== 'playing') {
                return reply(`❌ *No active game.* Start with *.ttt*`);
            }
            const idx = pos - 1;
            if (game.cells[idx] !== null) return reply(`❌ *That spot is already taken!*`);

            let mark = null;
            if (game.mode === 'group') {
                if (sender === game.players.X) mark = 'X';
                else if (sender === game.players.O) mark = 'O';
                else return reply(`👀 *You're not in this game!*`);
                if (game.turn !== mark) {
                    const waiting = mark === 'X' ? 'O' : 'X';
                    return await sock.sendMessage(from, {
                        text: `⏳ Wait your turn — it's @${game.players[waiting].split('@')[0]}'s go.`,
                        mentions: [game.players[waiting]],
                    }, { quoted: msg });
                }
            } else {
                if (sender !== game.player) return reply(`👀 *This game isn't for you!*`);
                if (game.turn !== game.pMark) return reply(`⏳ *Bot is thinking...*`);
                mark = game.pMark;
            }

            game.cells[idx] = mark;

            const win = checkWinner(game.cells);
            const draw = !win && isDraw(game.cells);

            if (win || draw) {
                games.delete(from);
                if (draw) {
                    return await sendBoardCard(sock, from, game, `🤝 DRAW — well played.`);
                }
                const winnerJid = game.mode === 'group'
                    ? game.players[win.mark]
                    : (win.mark === game.pMark ? game.player : null);
                game.turn = win.mark;
                return await sendBoardCard(sock, from, game,
                    winnerJid ? `🏆 @${winnerJid.split('@')[0]} WINS` : `😈 BOT WINS`,
                    win.line);
            }

            game.turn = game.turn === 'X' ? 'O' : 'X';

            if (game.mode === 'bot' && game.turn === game.bMark) {
                await sendBoardCard(sock, from, game, `🤖 Bot is thinking...`);
                await new Promise(r => setTimeout(r, 700));
                const botIdx = botMove(game.cells, game.bMark, game.pMark);
                if (botIdx < 0) {
                    games.delete(from);
                    return await sendBoardCard(sock, from, game, `🤝 DRAW`);
                }
                game.cells[botIdx] = game.bMark;
                const bWin = checkWinner(game.cells);
                const bDraw = !bWin && isDraw(game.cells);
                if (bWin || bDraw) {
                    games.delete(from);
                    if (bDraw) return await sendBoardCard(sock, from, game, `🤝 DRAW`);
                    game.turn = bWin.mark;
                    return await sendBoardCard(sock, from, game, `😈 BOT WINS`, bWin.line);
                }
                game.turn = game.pMark;
                return await sendBoardCard(sock, from, game,
                    `🤖 Bot played ${botIdx + 1} — your turn`);
            }

            const nextPlayer = game.mode === 'group' ? game.players[game.turn] : null;
            return await sendBoardCard(sock, from, game,
                nextPlayer ? `@${nextPlayer.split('@')[0]}'s turn` : 'Your turn');
        }

        // ── DIRECT CHALLENGE @PERSON ──────────────────────────────────────────
        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;

        if (isGroup && (mentions.length > 0 || (sub && sub !== 'bot' && sub !== 'start' && quotedParticipant))) {
            const opponent = mentions[0] || quotedParticipant;
            if (opponent && opponent === sender) return reply(`🤦 *You can't challenge yourself!*`);
            if (opponent) {
                if (game) return reply(`❌ *A game is already active here.* *.ttt quit* to end.`);
                const newGame = makeGroupGame(sender, opponent, sender);
                games.set(from, newGame);
                return await sendBoardCard(sock, from, newGame,
                    `CHALLENGE — @${sender.split('@')[0]} vs @${opponent.split('@')[0]}`);
            }
        }

        // ── SOLO vs BOT ───────────────────────────────────────────────────────
        if (sub === 'bot') {
            if (game) return reply(`❌ *A game is already running.* *.ttt quit* to end.`);
            const newGame = makeBotGame(sender);
            games.set(from, newGame);
            return await sendBoardCard(sock, from, newGame, `YOU ❌ vs BOT ⭕ — your move`);
        }

        // ── OPEN LOBBY ────────────────────────────────────────────────────────
        if (!sub || sub === 'start') {
            if (game) {
                if (game.state === 'lobby') return await sendLobbyCard(sock, from, game);
                return await sendBoardCard(sock, from, game, `Game already running`);
            }
            const lobby = {
                mode: 'group',
                state: 'lobby',
                startedBy: sender,
                players: [sender],
                lobbyDeadline: Date.now() + LOBBY_MS,
                _lobbyTimer: null,
            };
            games.set(from, lobby);
            registerLobby(sock, from, lobby);
            lobby._lobbyTimer = setTimeout(() =>
                startGroupFromLobby(sock, from, msg).catch(e => console.error('[ttt-lobby]', e.message)),
                LOBBY_MS);
            await sendLobbyCard(sock, from, lobby);
            return;
        }

        return reply(
            `🎮 *Tic-Tac-Toe*\n\n` +
            `• *.ttt* — open a lobby\n` +
            `• *.ttt @player* — direct challenge\n` +
            `• *.ttt bot* — solo vs bot\n` +
            `• *.ttt 1-9* — place piece\n` +
            `• *.ttt board* — show board\n` +
            `• *.ttt quit* — forfeit`
        );
    },
};
