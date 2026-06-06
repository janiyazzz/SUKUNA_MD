# SUKUNA MD v3

<p align="center">
  <img src="./sukuna.jpg" width="350" alt="SUKUNA MD">
</p>

<h1 align="center">⚔️ SUKUNA MD v3 ⚔️</h1>

<p align="center">
  Panel-Paired Multi-User WhatsApp Bot
</p>

---

## 📱 How Pairing Works

1. Deploy on Pterodactyl or VPS.
2. Start the bot.
3. The console will display:

```bash
[PAIR] Enter WhatsApp number with country code:
```

4. Enter your number (Example: `2349127857212`).
5. The bot generates an 8-character pairing code:

```bash
XXXX-XXXX
```

6. Open WhatsApp on your phone:

```
WhatsApp
└── Linked Devices
    └── Link with Phone Number
```

7. Enter the pairing code.
8. Session is automatically saved inside:

```bash
./sessions/<number>/
```

and reconnects automatically after restart.

---

## 🔄 Pair Additional Numbers

To pair another account:

- Type `y` when prompted with:

```bash
Pair another number?
```

or

- Restart the bot and pair a new account.

Existing sessions are restored automatically.

---

## ⚡ Non-Interactive Pairing

If your panel does not support console input, use:

```env
PAIR_NUMBER=2349127857212
```

before starting the bot.

The pairing code will be printed once in the logs.

---

## 🦖 Pterodactyl Deployment

### Requirements

- Node.js 18+

### Setup

```bash
npm install --omit=dev
```

### Startup Command

```bash
node index.js
```

### Optional Variables

| Variable | Description |
|-----------|-------------|
| OWNER_NUMBER | Owner WhatsApp Number |
| PAIR_NUMBER | Auto-pair on boot |
| OPENAI_API_KEY | OpenAI Integration |
| WEATHER_API_KEY | Weather Integration |

After startup:

1. Open **Console**
2. Follow pairing instructions
3. Link your WhatsApp

---

## 💻 VPS Deployment

```bash
git clone <your-fork>
cd sukuna-md

npm install --omit=dev

# Interactive
node index.js

# Headless
PAIR_NUMBER=2349127857212 node index.js
```

Recommended process managers:

```bash
pm2
systemd
screen
```

---

## 📂 Project Structure

```text
index.js
│
├── config.js
│
├── lib/
│   ├── sessionManager.js
│   └── gameLobby.js
│
├── commands/
│
├── utils/
│
├── assets/
│   ├── menuvideo.mp4
│   └── menuthumb.jpg
│
├── data/
│
└── sessions/
```

### Structure Details

```text
index.js              → Entry Point
config.js             → Configuration
lib/sessionManager.js → WhatsApp Engine
lib/gameLobby.js      → Game System
commands/             → Commands
utils/                → Helpers
assets/               → Media Assets
data/                 → Saved Data
sessions/             → WhatsApp Sessions
```

---

## 👑 Credits

```yaml
Creator: PASQUA
Endpoints: CRYSONOVA
Bot Name: SUKUNA MD v3
```

---

## 📜 License

```text
MIT License
```

---

<p align="center">
  ⚔️ SUKUNA MD v3 • The King Of Curses ⚔️
</p>
