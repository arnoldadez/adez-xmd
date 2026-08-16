// --- BOT ---
let codeGenerated = false;

async function startBot() {
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

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📱 QR Code Generated (Fallback)');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ Disconnected: ${statusCode || 'unknown'}`);
            
            // Only reconnect if session doesn't exist yet
            if (!fs.existsSync(`${SESSION_DIR}/creds.json`)) {
                if (!codeGenerated) {
                    console.log('🔄 Retrying to generate code...');
                    setTimeout(startBot, 10000);
                } else {
                    console.log('⏳ Waiting for you to enter the pair code...');
                    // Keep the bot alive but don't regenerate
                    setTimeout(startBot, 60000);
                }
            } else {
                console.log('✅ Session found. Reconnecting normally...');
                setTimeout(startBot, 5000);
            }
        }

        if (connection === 'open') {
            console.log('✅ ADEZ XMD is ONLINE!');
            console.log(`👤 Owner: ${OWNER.name}`);
            console.log(`📞 +${OWNER.number}`);
        }
    });

    // --- AUTO-PAIR CODE GENERATION (ONCE) ---
    if (!fs.existsSync(`${SESSION_DIR}/creds.json`) && !codeGenerated) {
        console.log('🔑 No session found. Generating SINGLE Pair Code...');
        try {
            const code = await sock.requestPairingCode(OWNER.number);
            codeGenerated = true;
            console.log('=========================================');
            console.log(`📱 PAIRING CODE FOR +${OWNER.number}: ${code}`);
            console.log('=========================================');
            console.log('⚠️ DO NOT RESTART THE BOT UNTIL YOU ENTER THIS CODE!');
            console.log('Open WhatsApp → Settings → Linked Devices → Link with Phone Number');
            console.log(`Enter the code: ${code}`);
            console.log('⏳ The bot will keep trying to connect for 60 seconds.');
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
                    await sock.sendMessage(from, { text: `📌 ADEZ XMD MENU\n\n!ping - Test bot\n!owner - Show owner\n!menu - This menu` });
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
