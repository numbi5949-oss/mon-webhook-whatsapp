const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

// Tu peux changer ce mot de passe, retiens-le bien
const VERIFY_TOKEN = "lubum2026";

app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    console.log('Vérifié!');
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', (req, res) => {
  console.log("Nouveau message reçu:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

app.get('/', (req, res) => {
  res.send('Webhook en ligne!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Serveur démarré'));
