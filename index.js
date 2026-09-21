const express = require('express');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = "lubum2026";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else { res.sendStatus(403); }
});

app.post('/webhook', async (req, res) => {
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return res.sendStatus(200);

  console.log("Message recu de:", msg.from);
  res.sendStatus(200); // On repond vite a Meta

  // Envoi test direct, sans Lydia
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msg.from,
        text: { body: "Test OK ✅ Render arrive bien a envoyer un WhatsApp. Si tu vois ce message, le token est bon." }
      })
    });
    console.log("Resultat WA:", await r.text());
  } catch(e) { console.error(e); }
});

app.get('/', (req,res)=>res.send('TEST MODE'));
app.listen(process.env.PORT || 10000);
