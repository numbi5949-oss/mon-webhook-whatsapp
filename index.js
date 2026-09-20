const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = "lubum2026";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const AI_API_URL = process.env.AI_API_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];

    if (message && message.text) {
      const numeroClient = message.from;
      const texteClient = message.text.body;
      console.log(`Message de ${numeroClient}: ${texteClient}`);

      if (!AI_API_URL) {
        console.error("AI_API_URL manquant dans les variables d'environnement");
        return res.sendStatus(200);
      }

      // 1. Appel vers ton IA / Supabase
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
     .then(data => data.reply || data.response || data.message || '')
     .catch(err => {
        console.error("Erreur appel IA:", err);
        return "Désolé, je rencontre un petit souci technique. Un conseiller va vous répondre.";
      });

      console.log(`Reponse IA: ${reponseIA}`);

      if (!reponseIA) {
        console.log("Pas de réponse IA, on ne renvoie rien");
        return res.sendStatus(200);
      }

      // 2. Renvoi sur WhatsApp
      await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: numeroClient,
          text: { body: reponseIA }
        })
      });
    }
    res.sendStatus(200);
  } catch (e) {
    console.error("Erreur webhook:", e);
    res.sendStatus(200);
  }
});

app.get('/', (req, res) => {
  res.send('Webhook en ligne!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Serveur demarre sur le port ${PORT}`);
});
