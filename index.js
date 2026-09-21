const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = "lubum2026";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "1239730502564843";
const AI_API_URL = process.env.AI_API_URL || "https://gyyfjzolylqhoxftsigy.supabase.co/functions/v1/whatsapp-public";
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

    if (!message ||!message.text) {
      return res.sendStatus(200);
    }

    const numeroClient = message.from;
    const texteClient = message.text.body;
    console.log(`[1] Message recu de ${numeroClient}: ${texteClient}`);

    // === ETAPE CRITIQUE CORRIGEE PAR MEDO ===
    // On attend Lydia AVANT de répondre à Meta

    let reponseIA = "";
    try {
      // Timeout de 18s car Meta abandonne après 20s
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18000);

      const supabaseRes = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY?.trim()}`,
          'apikey': SUPABASE_ANON_KEY?.trim()
        },
        body: JSON.stringify({ message: texteClient, phone: numeroClient }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      const data = await supabaseRes.json();
      reponseIA = data.reply || data.response || data.message || "";
      console.log(`[2] Reponse Lydia: ${reponseIA}`);

    } catch (err) {
      console.error("[2-ERREUR] Appel Supabase a échoué:", err.message);
      reponseIA = "Désolé, je rencontre un petit souci technique. Un agent va vous répondre.";
    }

    // 3. On envoie sur WhatsApp
    if (reponseIA) {
      if (!WHATSAPP_TOKEN) {
        console.error("[3-ERREUR] WHATSAPP_TOKEN vide sur Render");
      } else {
        const waRes = await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WHATSAPP_TOKEN.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: numeroClient,
            text: { body: reponseIA }
          })
        });
        const waData = await waRes.json();
        console.log(`[3] Envoi WhatsApp:`, JSON.stringify(waData));
      }
    }

    // 4. ON REPOND A META SEULEMENT MAINTENANT, APRES TOUT
    console.log("[4] On repond 200 a Meta");
    return res.sendStatus(200);

  } catch (e) {
    console.error("Erreur webhook globale:", e);
    return res.sendStatus(200);
  }
});

app.get('/', (req, res) => res.send('Webhook en ligne - Version Medo Fix'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serveur demarre sur ${PORT}`));
