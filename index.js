/**
 * Webhook intermédiaire — EDUC-COMPTA-AFRICA
 *
 * RÔLE UNIQUE : recevoir les événements Meta WhatsApp et les transmettre
 *               TELS QUELS à l'Edge Function Supabase (whatsapp-public / Lydia).
 *
 * RÈGLES CRITIQUES :
 *   1. On transmet le payload Meta BRUT — PAS {message, phone}
 *   2. On await fetch(Supabase) AVANT de répondre 200 à Meta
 *   3. On N'envoie PAS sur WhatsApp depuis Render — whatsapp-public le fait
 *   4. On ne lit PAS data.reply — whatsapp-public retourne "EVENT_RECEIVED"
 *
 * Variables d'environnement sur Render :
 *   VERIFY_TOKEN      = lubum2026
 *   SUPABASE_URL      = https://gyyfjzolylqhoxftsigy.supabase.co/functions/v1/whatsapp-public
 *   SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */

const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));

const VERIFY_TOKEN      = (process.env.VERIFY_TOKEN || 'lubum2026').trim();
const SUPABASE_URL      = (process.env.SUPABASE_URL || 'https://gyyfjzolylqhoxftsigy.supabase.co/functions/v1/whatsapp-public').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
const PORT              = process.env.PORT              || 10000;

console.log('Config chargee:', {
  verifyToken: VERIFY_TOKEN,
  supabaseUrl: SUPABASE_URL,
  hasAnonKey: !!SUPABASE_ANON_KEY,
  anonKeyPreview: SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 25) + '...' : 'MANQUANTE',
  anonKeyLength: SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.length : 0
});

// Sante
app.get('/', (req, res) => res.send('Webhook en ligne! Lydia connectee.'));

// GET : verification Meta
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  console.log('[VERIFY] mode=' + mode + ' token_ok=' + (token === VERIFY_TOKEN));
  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    console.log('[VERIFY] OK');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// POST : reception Meta → transmission Supabase
// CRITIQUE : await AVANT res.sendStatus(200)
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (!body || body.object !== 'whatsapp_business_account') {
    console.log('[POST] objet ignore:', body && body.object);
    return res.sendStatus(200);
  }

  if (!SUPABASE_ANON_KEY) {
    console.error('[POST] SUPABASE_ANON_KEY MANQUANTE — ajouter dans Render > Environment');
    return res.sendStatus(200);
  }

  console.log('[TRANSMIT] -> Supabase:', JSON.stringify(body).slice(0, 300));

  try {
    // Nettoyage critique : Render ajoute parfois un \n ou espace invisible qui cause
    // l'erreur "Auth header is not 'Bearer {token}'"
    const cleanKey = SUPABASE_ANON_KEY.replace(/[\r\n\s]/g, '').trim();
    const cleanUrl = SUPABASE_URL.replace(/[\r\n\s]/g, '').trim();
    
    if (!cleanKey) {
      console.error('[TRANSMIT] SUPABASE_ANON_KEY vide apres trim');
      return res.sendStatus(200);
    }

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

    if (response.status === 401) {
      console.error('[TRANSMIT] 401 = Cle ANON invalide ou expiree. Va sur Supabase > Project Settings > API > copie la nouvelle anon public key et colle-la dans Render > Environment > SUPABASE_ANON_KEY');
    }

  } catch (err) {
    const isAbort = err && (err.name === 'AbortError' || err.name === 'TimeoutError');
    const msg = isAbort
      ? 'Timeout 18s (Lydia a mis plus de 18s, mais on va quand meme repondre 200 a Meta pour eviter le retry)'
      : ((err && err.message) || String(err));
    console.error('[TRANSMIT] Erreur:', msg);
  }

  // On repond 200 a Meta APRES que Supabase ait traite (ou apres timeout)
  // C'est le fix de Medo : await d'abord, res.sendStatus ensuite
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log('Serveur demarre sur le port ' + PORT);
});
