# SUKUNA MD v3

Panel-paired multi-user WhatsApp bot. No web UI, no Telegram bridge — the
panel console **is** the pairing interface.

## How pairing works

1. Deploy on Pterodactyl / VPS panel (see below).
2. Start the bot. The panel console prompts:
   `[PAIR] Enter WhatsApp number with country code:`
3. Type the number (e.g. `2349127857212`) and press Enter.
4. The bot prints an 8-character pairing code: `XXXX-XXXX`.
5. On the phone: **WhatsApp → Linked Devices → Link with phone number** →
   enter the code.
6. Done. The session is saved to `./sessions/<number>/` and auto-reconnects
   on every restart.

To pair more accounts later, answer `y` to the "Pair another number?"
prompt, or restart the bot and the prompt appears again. Existing sessions
restore automatically; pairing is only requested for new numbers.

## Non-interactive pairing

If your panel does not give you an interactive console, set the env var
`PAIR_NUMBER=<number>` before start. The pairing code is printed once in
the logs, then the bot stays running normally. Unset the var on the next
restart.

## Pterodactyl deploy

1. Create a Node.js 18+ egg / server.
2. Upload this project (or `git clone` it).
3. Install command: `npm install --omit=dev`
4. Startup command: `node index.js`
5. Optional env vars (Startup → Variables):
   - `OWNER_NUMBER` — your WhatsApp number, used by owner-only commands.
   - `PAIR_NUMBER` — auto-pair this number on boot (non-interactive panels).
   - `OPENAI_API_KEY`, `WEATHER_API_KEY` — optional command integrations.
6. Start the server. Open the **Console** tab and follow the pair prompt.

## VPS deploy

```bash
git clone <your-fork>
cd sukuna-md
npm install --omit=dev
node index.js          # interactive
# or, headless:
PAIR_NUMBER=2349127857212 node index.js
```

Use `pm2`, `systemd`, or `screen` to keep it running.

## Project layout

```
index.js              # entry; restores sessions + CLI pair prompt
config.js             # bot name, prefix, owner, session paths
lib/sessionManager.js # Baileys engine — sockets, reconnect, dispatch
lib/gameLobby.js      # in-chat games state
commands/             # all bot commands, hot-loaded at boot
utils/                # helpers (commandLoader, etc.)
assets/               # menuvideo.mp4 / menuthumb.jpg
data/                 # persisted per-group settings, warns, etc.
sessions/             # Baileys auth state per number (auto-created)
```

## License

MIT
