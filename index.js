// Crypto polyfill for Render
global.crypto = require('crypto');

const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const fs = require('fs');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

// Session folder
const SESSION_DIR = './session';
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR);

// Owner details
const OWNER = {
    name: "Arnold Adez",
    number: "254111783552"
};

// --- WEB SERVER ---
app.get('/', async (req, res) => {
    const sessionExists = fs.existsSync(`${SESSION_DIR}/creds.json`);
    
    if (sessionExists) {
        res.send(`
        <html>
        <head><title>ADEZ XMD</title>
        <style>
            body { font-family: Arial; text-align: center; background: #f0f0f0; padding: 20px; }
            .container { max-width: 400px; margin: auto; background: white; padding: 30px; border-radius: 15px; }
            .status { background: #25D366; color: white; padding: 10px; border-radius: 5px; }
        </style>
        </head>
        <body>
            <div class="container">
                <h1>🔴 ADEZ XMD</h1>
                <div class="status">🟢 ONLINE</div>
                <p><strong>Owner:</strong> ${OWNER.name}</p>
                <p><strong>Number:</strong> +${OWNER.number}</p>
                <p>Send <code>!ping</code> to test.</p>
            </div>
        </body>
        </html>
        `);
    } else {
        res.send(`
        <html>
        <head><title>ADEZ XMD</title>
        <meta http-equiv="refresh" content="10">
        <style>
            body { font-family: Arial; text-align: center; background: #f0f0f0; padding: 20px; }
            .container { max-width: 400px; margin: auto; background: white; padding: 30px; border-radius: 15px; }
            .status { background: #ffa500; color: white; padding: 10px; border-radius: 5px; }
        </style>
        </head>
        <body>
            <div class="container">
                <h1>🔴 ADEZ XMD</h1>
                <div class="status">⏳ Waiting for QR...</div>
                <p>Check your Render Logs for your Pairing Code!</p>
                <p><strong>Owner:</strong> ${OWNER.name}</p>
                <p><strong>Number:</strong> +${OWNER.number}</p>
            </div>
        </body>
        </html>
        `);
    }
});

// --- API ENDPOINTS ---
app.get('/status', (req, res) => {
    const sessionExists = fs.existsSync(`${SESSION_DIR}/creds.json`);
    res.json({
        status: sessionExists ? 'online' : 'waiting',
        owner: OWNER.name,
        number: OWNER.number
    });
});

app.get('/api/pair', async (req, res) => {
    const number = req.query.number?.replace(/[^0-9]/g, '');
    if (!number || number.length < 10) {
        return res.json({ success: false, message: 'Invalid number' });
    }
    try {
        if (!global.sock) {
            return res.json({ success: false, message: 'Bot is starting, please wait 30s' });
        }
        const code = await global.sock.requestPairingCode(number);
        res.json({ success: true, code });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

// Serve the pair page
app.get('/pair', (req, res) => {
    const pairPath = __dirname + '/pair.html';
    if (fs.existsSync(pairPath)) {
        res.sendFile(pairPath);
    } else {
        res.send('Please create pair.html file first.');
    }
});

app.listen(PORT, () => {
    console.log(`🌐 Web UI: http://localhost:${PORT}`);
});

// --- BOT ---
async function startBot() {
    console.log('🚀 Starting ADEZ XMD...');
    
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.ubuntu('ADEZ XMD'),
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    });

    global.sock = sock;

    // QR Handler
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📱 QR Code Generated (Fallback)');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ Disconnected: ${statusCode || 'unknown'}`);
            
            if (!fs.existsSync(`${SESSION_DIR}/creds.json`)) {
                console.log('⏳ Waiting for pair code entry...');
                setTimeout(startBot, 30000);
            } else {
                setTimeout(startBot, 5000);
            }
        }

        if (connection === 'open') {
            console.log('✅ ADEZ XMD is ONLINE!');
            console.log(`👤 Owner: ${OWNER.name}`);
            console.log(`📞 +${OWNER.number}`);

            // --- AUTO SET PROFILE PICTURE ---
            try {
                const logoUrl = 'https://res.cloudinary.com/dqxlb29uz/image/upload/v1786879188/bwm_uploads/media-1786879188852.jpg';
                const response = await fetch(logoUrl);
                const buffer = await response.arrayBuffer();
                await sock.updateProfilePicture(sock.user.id, Buffer.from(buffer), 'image/jpeg');
                console.log('✅ Bot profile picture set successfully!');
            } catch (e) {
                console.log('⚠️ Could not set profile picture:', e.message);
            }
        }
    });

    // Auto-pair code generation (only once)
    if (!fs.existsSync(`${SESSION_DIR}/creds.json`)) {
        console.log('🔑 No session found. Generating Pair Code...');
        try {
            const code = await sock.requestPairingCode(OWNER.number);
            console.log('=========================================');
            console.log(`📱 PAIRING CODE FOR +${OWNER.number}: ${code}`);
            console.log('=========================================');
            console.log('Open WhatsApp → Settings → Linked Devices → Link with Phone Number');
            console.log(`Enter the code: ${code}`);
        } catch (e) {
            console.log('❌ Failed to generate pair code:', e.message);
        }
    }

    // Message Handler
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && msg.message) {
            const body = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || 
                         '';
            const from = msg.key.remoteJid;
            const args = body.split(' ');
            const cmd = args[0].toLowerCase().replace('!', '');

            if (body.startsWith('!')) {
                if (cmd === 'ping') {
                    await sock.sendMessage(from, { text: 'Pong! 🏓' });
                }
                if (cmd === 'owner') {
                    await sock.sendMessage(from, { text: `👤 Owner: ${OWNER.name}\n📞 +${OWNER.number}` });
                }
                if (cmd === 'menu') {
                    await sock.sendMessage(from, { text: `📌 ADEZ XMD MENU\n\n!ping - Test bot\n!owner - Show owner\n!menu - This menu\n!uptime - Bot uptime` });
                }
                if (cmd === 'uptime') {
                    const uptime = process.uptime();
                    const h = Math.floor(uptime / 3600);
                    const m = Math.floor((uptime % 3600) / 60);
                    await sock.sendMessage(from, { text: `🟢 Uptime: ${h}h ${m}m` });
                }
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Start bot
startBot();
