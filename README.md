# SUKUNA MD v3 — Panel Edition

Single-file, paste-and-run WhatsApp bot. No git, no `.env`, no `config.js`.

## Deploy in 4 steps

1. In your panel (Pterodactyl / Heroku / VPS / any Node host), create a new
   file named **`index.js`**.
2. Open `index.js` from this repository, copy the entire contents, and paste
   it into the file you just created on the panel.
3. Edit the **SETTINGS** block at the very top:

   ```js
   const SETTINGS = {
       SESSION_ID:   "PASTE_YOUR_SESSION_ID_HERE", // from the pairing site
       OWNER_NUMBER: "2349127857212",              // your number, no +
       PAIR_NUMBER:  "2349127857212",              // same as above (usually)
       PREFIX:       ".",
       BOT_NAME:     "SUKUNA MD",
       REPO:   "pasquawisdom2007-beep/SUKUNA_MD",
       BRANCH: "main"
   };
   ```

4. Save the file and press **Start** on your panel.

That's it. On first boot, `index.js` will:

- Download the rest of the bot from the GitHub repo
- Install npm dependencies
- Restore your WhatsApp session from `SESSION_ID`
- Start the bot

## Session ID

Get a `SESSION_ID` from your pairing site. Both formats are supported:

- **Base64** (the site shows a long string like `SUKUNA~eyJub2lzZUtleSI6...`)
- **Mega.nz** link (`SUKUNA~fileId#decryptKey` or a full `https://mega.nz/file/...` URL)

If `SESSION_ID` is left blank, the bot falls back to printing an 8-character
pairing code in the console (WhatsApp → Linked devices → Link with phone number).

## Notes

- The startup file owns all configuration. There is no `config.js` and no
  `.env` to maintain.
- To update the bot, just delete the auto-downloaded folders (`lib/`,
  `utils/`, `commands/`, `assets/`) and restart — `index.js` will re-fetch
  the latest version.
