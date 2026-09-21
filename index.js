const express = require('express');
const app = express();
app.use(express.json());

// --- CONFIG ---
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "lubum2026";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "1239730502564843";
const AI_API_URL = process.env.AI_API_URL || "https://gyyfjzolylqhoxftsigy.supabase.co/functions/v1/whatsapp-public";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

console.log("Config chargee:", {
  hasToken:!!WHATSAPP_TOKEN,
  phoneId: PHONE_NUMBER_ID,
  aiUrl: AI_API_URL,
  hasSupabaseKey:!!SUPABASE_ANON_KEY
});

// Verification webhook pour Meta
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    console.log("Webhook verifie!");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// Reception des messages
app.post('/webhook', async (req, res) => {
  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (!message ||!message.text) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text.body;
    console.log(`[1] Message de ${from}: ${text}`);

    // On repond 200 a Meta IMMEDIATEMENT (obligatoire, sinon Meta re-envoie 3 fois)
    res.sendStatus(200);

    // --- TRAITEMENT EN ARRIERE-PLAN ---
    let reply = "";

    try {
      const supaRes = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY.trim()}`,
          'apikey': SUPABASE_ANON_KEY.trim()
        },
        body: JSON.stringify({ message: text, phone: from })
      });

      const raw = await supaRes.text();
      console.log(`[2] Supabase [${supaRes.status}]: ${raw}`);

      try {
        const data = JSON.parse(raw);
        reply = data.reply || data.response || data.message || "";
      } catch {
        reply = raw;
      }

    } catch (e) {
      console.error("[2-ERREUR] Supabase:", e.message);
      reply = "Désolé, je rencontre un souci technique. Un conseiller va vous répondre.";
    }

    if (!reply) {
      console.log("[3] Pas de reponse IA, on arrete");
      return;
    }

    // Envoi WhatsApp
    if (!WHATSAPP_TOKEN ||!PHONE_NUMBER_ID) {
      console.error("[3-ERREUR] WHATSAPP_TOKEN ou PHONE_NUMBER_ID manquant sur Render");
      return;
    }

    try {
      const waRes = await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: from,
          text: { body: reply }
        })
      });

      const waRaw = await waRes.text();
      console.log(`[3] WhatsApp [${waRes.status}]: ${waRaw}`);

    } catch (e) {
      console.error("[3-ERREUR] WhatsApp:", e.message);
    }

  } catch (e) {
    console.error("Erreur globale webhook:", e);
    // On a deja repondu 200 plus haut, pas besoin de re-repondre
  }
});

app.get('/', (req, res) => {
  res.send('Webhook Lydia en ligne - OK');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serveur demarre sur ${PORT}`));
