/**
 * Webhook intermédiaire — EDUC-COMPTA-AFRICA
 * 
 * Rôle : recevoir les événements Meta WhatsApp et les transmettre
 *        à l'Edge Function Supabase (Lydia / whatsapp-public).
 * 
 * Variables d'environnement requises sur Render :
 *   VERIFY_TOKEN      = lubum2026
 *   SUPABASE_URL      = https://gyyfjzolylqhoxftsigy.supabase.co/functions/v1/whatsapp-public
 *   SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *   PORT              = 3000 (optionnel, Render le fournit automatiquement)
 */

const express = require('express');
const app = express();

// ─── Config ───────────────────────────────────────────────────────────────────
const VERIFY_TOKEN      = process.env.VERIFY_TOKEN      || 'lubum2026';
const SUPABASE_URL      = process.env.SUPABASE_URL      || 'https://gyyfjzolylqhoxftsigy.supabase.co/functions/v1/whatsapp-public';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const PORT              = process.env.PORT              || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());

// ─── Santé ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) =&gt; {
  res.send('Webhook en ligne!');
});

// ─── GET : vérification Meta ──────────────────────────────────────────────────
app.get('/webhook', (req, res) =&gt; {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`[VERIFY] mode=${mode} token_ok=${token === VERIFY_TOKEN}`);

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[VERIFY] ✅ Webhook vérifié par Meta');
    return res.status(200).send(challenge);
  }

  console.error('[VERIFY] ❌ Token invalide — reçu:', token);
  return res.sendStatus(403);
});

// ─── POST : messages entrants ─────────────────────────────────────────────────
app.post('/webhook', (req, res) =&gt; {
  const body = req.body;

  if (body.object !== 'whatsapp_business_account') {
    console.warn('[POST] objet inconnu:', body.object);
    return res.sendStatus(404);
  }

  // Répondre immédiatement 200 à Meta (évite les retries)
  res.sendStatus(200);

  // Transmettre à Supabase en arrière-plan
  transmettreASupabase(body).catch(err =&gt; {
    console.error('[TRANSMIT] Erreur non gérée:', err.message || err);
  });
});

// ─── Transmission à Supabase (Lydia) ─────────────────────────────────────────
async function transmettreASupabase(payload) {
  if (!SUPABASE_ANON_KEY) {
    console.error('[TRANSMIT] ❌ SUPABASE_ANON_KEY manquante — message non transmis');
    return;
  }

  try {
    console.log('[TRANSMIT] → Supabase :', JSON.stringify(payload).slice(0, 200));

    const response = await fetch(SUPABASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (response.ok) {
      console.log('[TRANSMIT] ✅ Supabase a traité le message — statut:', response.status);
    } else {
      const errText = await response.text().catch(() =&gt; '');
      console.error(`[TRANSMIT] ❌ Supabase erreur ${response.status}:`, errText.slice(0, 300));
    }
  } catch (err) {
    if (err.name === 'TimeoutError') {
      console.warn('[TRANSMIT] ⚠️ Timeout — Lydia a pris plus de 30s');
    } else {
      console.error('[TRANSMIT] ❌ Exception:', err.message || String(err));
    }
  }
}

// ─── Démarrage ────────────────────────────────────────────────────────────────
app.listen(PORT, () =&gt; {
  console.log(`✅ Webhook EDUC-COMPTA-AFRICA démarré sur le port ${PORT}`);
  console.log(`   VERIFY_TOKEN     : ${VERIFY_TOKEN}`);
  console.log(`   SUPABASE_URL     : ${SUPABASE_URL}`);
  console.log(`   SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? '✅ configurée' : '❌ MANQUANTE'}`);
});
📄 Fichier 2 : package.json
{
  "name": "webhook-educ-compta-africa",
  "version": "1.0.0",
  "description": "Webhook intermédiaire Meta → Supabase (Lydia)",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "engines": {
    "node": "&gt;=18.0.0"
  }
}
