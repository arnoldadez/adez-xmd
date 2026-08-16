const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const pino = require('pino');

async function getSession() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state
    });

    console.log("📱 SCAN THE QR CODE THAT APPEARS IN YOUR TERMINAL WITH WHATSAPP");
    
    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) console.log("QR Code displayed above. Scan it with WhatsApp.");
        if (connection === 'open') {
            console.log("✅ SUCCESS! Bot is connected locally.");
            console.log("🛑 Press Ctrl+C to stop the script.");
            console.log("📁 The 'session' folder is now ready to upload to Render.");
            // Save the credentials
            saveCreds();
            process.exit(0);
        }
    });
}

getSession();
