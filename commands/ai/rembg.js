/**
 * Remove Background Command
 * Usage: .rembg [reply to image/video] or .rembg [image/video URL]
 */

const axios = require("axios");
const { isUrl } = require("../../lib/mediaFetch"); // Assuming a utility for URL check

// Placeholder for API Key - User should set this up
const REMOVEBG_API_KEY = process.env.REMOVEBG_API_KEY || "YOUR_REMOVEBG_API_KEY";

module.exports = {
    name: "rembg",
    aliases: ["removebg", "rbg"],
    description: "Removes background from an image or video.",
    category: "media",
    async execute({ sock, msg, from, reply, quoted, args }) {
        let media = null;
        let mime = null;

        if (quoted && (quoted.image || quoted.video)) {
            media = await quoted.download();
            mime = quoted.mimetype;
        } else if (args[0] && isUrl(args[0])) {
            media = args[0];
            mime = media.includes("video") ? "video" : "image"; // Basic mime guess for URL
        } else {
            return reply("🖼️ *Remove Background*\n\nPlease reply to an image/video or provide an image/video URL to remove its background.");
        }

        if (!media) {
            return reply("❌ Could not retrieve media. Please try again.");
        }

        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
        await reply("⏳ *Removing background...* This may take a moment.");

        try {
            let resultBuffer = null;
            let usedApi = "";

            // --- STAGE 1: remove.bg API ---
            if (REMOVEBG_API_KEY !== "YOUR_REMOVEBG_API_KEY") {
                try {
                    console.log("[rembg] Trying remove.bg API...");
                    const formData = new FormData();
                    formData.append("image_file", media, "image.png"); // Assuming image for now
                    formData.append("size", "auto");

                    const res = await axios.post("https://api.remove.bg/v1.0/removebg", formData, {
                        headers: {
                            ...formData.getHeaders(),
                            "X-Api-Key": REMOVEBG_API_KEY,
                            "Accept": "application/json"
                        },
                        responseType: "arraybuffer",
                        timeout: 30000
                    });

                    if (res.status === 200) {
                        resultBuffer = Buffer.from(res.data);
                        usedApi = "remove.bg";
                    } else {
                        console.error(`[rembg] remove.bg API failed with status ${res.status}:`, res.data.toString());
                    }
                } catch (e) {
                    console.error("[rembg] remove.bg API error:", e.message);
                }
            }

            // --- STAGE 2: Fallback Public API (Example: prexzyapis.com/api/removebg) ---
            if (!resultBuffer) {
                try {
                    console.log("[rembg] Trying Prexzy API fallback...");
                    // This is a placeholder. Actual implementation would need to handle file uploads or URL passing.
                    // For simplicity, assuming a direct URL for now if media is a URL.
                    if (typeof media === 'string' && isUrl(media)) {
                        const res = await axios.get(`https://prexzyapis.com/api/removebg?url=${encodeURIComponent(media)}`, {
                            responseType: "arraybuffer",
                            timeout: 45000
                        });
                        if (res.status === 200) {
                            resultBuffer = Buffer.from(res.data);
                            usedApi = "Prexzy API";
                        }
                    } else {
                        // If media is a buffer, it would need to be uploaded to a temporary service or sent as multipart/form-data
                        console.log("[rembg] Prexzy API fallback for buffer media not implemented yet.");
                    }
                } catch (e) {
                    console.error("[rembg] Prexzy API fallback error:", e.message);
                }
            }

            if (!resultBuffer) {
                await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
                return reply("❌ *ERROR:* All background removal engines are currently unavailable or failed.\n\nPossible reasons:\n1. Invalid media.\n2. API limits reached.\n3. Servers are down.");
            }

            await sock.sendMessage(from, {
                image: resultBuffer,
                mimetype: "image/png",
                caption: `🖼️ *Background Removed*\n\n🚀 *Engine:* ${usedApi}\n\n> Processed by SUKUNA MD`,
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error("[rembg] Fatal:", err.message);
            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
            reply("❌ *FATAL ERROR:* The command encountered an unexpected error. Please try again later.");
        }
    },
};
