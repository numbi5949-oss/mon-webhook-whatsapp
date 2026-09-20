const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = "lubum2026";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const AI_API_URL = process.env.AI_API_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

app.get('/webhook', (req, res) =&gt; {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) =&gt; {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];

    if (message && message.text) {
      const numeroClient = message.from;
      const texteClient = message.text.body;
      console.log('Message de ' + numeroClient + ': ' + texteClient);

      const reponseIA = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ message: texteClient, phone: numeroClient })
      }).then(function(r) { return r.json(); }).then(function(data) {
        return data.reply || data.response || data.message || '';
      });

      console.log('Reponse IA: ' + reponseIA);

      await fetch('https://graph.facebook.com/v19.0/' + PHONE_NUMBER_ID + '/messages', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + WHATSAPP_TOKEN,
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
    console.error(e);
    res.sendStatus(200);
  }
});

app.get('/', function(req, res) { res.send('Webhook en ligne!'); });
app.listen(process.env.PORT || 10000, function() { console.log('Serveur demarre'); });
📄 Fichier 2 : package.json
{
  "name": "webhook-whatsapp",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "body-parser": "^1.20.2",
    "express": "^4.18.2"
  },
  "engines": {
    "node": "&gt;=18.0.0"
  }
}
