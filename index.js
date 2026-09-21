const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = "lubum2026";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "1239730502564843";
const AI_API_URL = process.env.AI_API_URL || "https://gyyfjzolylqhoxftsigy.supabase.co/functions/v1/whatsapp-public";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Verification Meta
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// Reception + IA + Renvoi
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];

    if (message && message.text) {
      const numeroClient = message.from;
      const texteClient = message.text.body;
      console.log(`Message de ${numeroClient}: ${texteClient}`);

      // 1. Appeler Lydia
      const reponseIA = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ message: texteClient, phone: numeroClient })
      })
     .then(r => r.json())
     .then(data => data.reply || data.response || data.message || "")
     .catch(err => {
        console.error("Erreur appel Lydia:", err);
        return "";
      });

      console.log(`Reponse Lydia: ${reponseIA}`);

      if (!reponseIA) {
        return res.sendStatus(200);
      }

      // 2. Renvoyer sur WhatsApp via Meta - VERSION CORRIGEE
      if (!WHATSAPP_TOKEN) {
        console.error("ERREUR CRITIQUE: WHATSAPP_TOKEN est vide sur Render! Va dans Environment");
        return res.sendStatus(200);
      }

      const cleanToken = WHATSAPP_TOKEN.trim();

      const waResult = await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: numeroClient,
          text: { body: reponseIA }
        })
      }).then(r => r.json());

      console.log("Envoi WhatsApp:", JSON.stringify(waResult));

      if (waResult.error) {
        console.error("Erreur Meta:", waResult.error.message);
      }
    }

    res.sendStatus(200);
  } catch (e) {
    console.error("Erreur webhook:", e);
    res.sendStatus(200);
  }
});

app.get('/', (req, res) => {
  res.send('Webhook en ligne! Lydia connectee.');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Serveur demarre sur le port ${PORT}`);
});
