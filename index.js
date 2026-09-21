/**
 * Webhook intermédiaire — EDUC-COMPTA-AFRICA — FINAL
 */
const express = require('express');
const app = express();
app.use(express.json({ limit: '2mb' }));

const VERIFY_TOKEN = (process.env.VERIFY_TOKEN || 'lubum2026').trim();
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://gyyfjzolylqhoxftsigy.supabase.co/functions/v1/whatsapp-public').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Webhook en ligne! Lydia connectee.'));

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (!body || body.object !== 'whatsapp_business_account') {
    return res.sendStatus(200);
  }
  if (!SUPABASE_ANON_KEY) return res.sendStatus(200);

  try {
    const cleanKey = SUPABASE_ANON_KEY.replace(/[\r\n\s]/g, '').trim();
    const cleanUrl = SUPABASE_URL.replace(/[\r\n\s]/g, '').trim();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    const response = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cleanKey,
        'apikey': cleanKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const text = await response.text().catch(() => '');
    console.log('[TRANSMIT] Supabase ' + response.status + ': ' + text.slice(0, 500));
  } catch (err) {
    console.error('[TRANSMIT] Erreur:', err.message);
  }

  res.sendStatus(200);
});

app.listen(PORT, () => console.log('Serveur demarre sur ' + PORT));
