/**
 * Webhook intermÃ©diaire â€” EDUC-COMPTA-AFRICA
 *
 * RÃ”LE UNIQUE : recevoir les Ã©vÃ©nements Meta WhatsApp et les transmettre
 *               TELS QUELS Ã  l'Edge Function Supabase (whatsapp-public / Lydia).
 *
 * RÃˆGLES CRITIQUES :
 *   1. On transmet le payload Meta BRUT â€” PAS {message, phone}
 *   2. On await fetch(Supabase) AVANT de rÃ©pondre 200 Ã  Meta
 *   3. On N'envoie PAS sur WhatsApp depuis Render â€” whatsapp-public le fait
 *   4. On ne lit PAS data.reply â€” whatsapp-public retourne "EVENT_RECEIVED"
 *
 * Variables d'environnement sur Render :
 *   VERIFY_TOKEN      = lubum2026
 *   SUPABASE_URL      = https://gyyfjzolylqhoxftsigy.supabase.co/functions/v1/whatsapp-public
 *   SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */

const express = require('express');
const app = express();
app.use(express.json());

const VERIFY_TOKEN      = process.env.VERIFY_TOKEN      || 'lubum2026';
const SUPABASE_URL      = process.env.SUPABASE_URL      || 'https://gyyfjzolylqhoxftsigy.supabase.co/functions/v1/whatsapp-public';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const PORT              = process.env.PORT              || 10000;

console.log('Config chargee:', {
  verifyToken: VERIFY_TOKEN,
  supabaseUrl: SUPABASE_URL,
  hasAnonKey: !!SUPABASE_ANON_KEY,
  anonKeyPreview: SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 20) + '...' : 'MANQUANTE'
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

// POST : reception Meta â†’ transmission Supabase
// CRITIQUE : await AVANT res.sendStatus(200)
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (!body || body.object !== 'whatsapp_business_account') {
    console.log('[POST] objet ignore:', body && body.object);
    return res.sendStatus(200);
  }

  if (!SUPABASE_ANON_KEY) {
    console.error('[POST] SUPABASE_ANON_KEY MANQUANTE â€” ajouter dans Render > Environment');
    return res.sendStatus(200);
  }

  console.log('[TRANSMIT] -> Supabase:', JSON.stringify(body).slice(0, 150));

  try {
    // AWAIT ici â€” on attend que whatsapp-public finisse (~8-10s)
    // Meta tolere jusqu'a 20s â€” on met 18s de timeout
    const response = await fetch(SUPABASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(18000),
    });

    const text = await response.text().catch(() => '');
    console.log('[TRANSMIT] Supabase ' + response.status + ': ' + text.slice(0, 80));

  } catch (err) {
    const msg = err && err.name === 'TimeoutError'
      ? 'Timeout 18s (Lydia trop lente ce coup)'
      : ((err && err.message) || String(err));
    console.error('[TRANSMIT] Erreur:', msg);
  }

  // On repond 200 a Meta APRES que Supabase ait traite
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log('Serveur demarre sur le port ' + PORT);
});
