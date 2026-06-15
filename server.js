/* ============================================================
   server.js — Point d'entrée principal
   Backend Storvital : Express + Stripe + Auth + Suivi commandes

   VARIABLES D'ENVIRONNEMENT REQUISES (Render Dashboard) :
     STRIPE_SECRET_KEY      → sk_live_... ou sk_test_...
     STRIPE_WEBHOOK_SECRET  → whsec_... (optionnel, pour les webhooks)
     FRONTEND_URL           → https://storvital.netlify.app
     PORT                   → injecté automatiquement par Render
   ============================================================ */

require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const { initDataFiles }  = require('./utils/db');
const { handleWebhook }  = require('./controllers/stripeController');

const stripeRoutes = require('./routes/stripe');
const authRoutes   = require('./routes/auth');
const orderRoutes  = require('./routes/orders');

const app         = express();
const PORT        = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

/* ============================================================
   1. WEBHOOK STRIPE
   Doit être monté AVANT express.json() car Stripe exige
   le corps brut (Buffer) pour vérifier la signature.
   ============================================================ */
app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  handleWebhook
);

/* ============================================================
   2. CORS
   Autorise uniquement le front Netlify (+ localhost en dev)
   ============================================================ */
app.use(cors({
  origin(origin, callback) {
    const allowed = [
      FRONTEND_URL,
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3000'
    ];
    // Autorise aussi les sous-domaines Netlify (previews de PR)
    const isNetlifyPreview = origin && /\.netlify\.app$/.test(origin);

    if (!origin || allowed.includes(origin) || isNetlifyPreview) {
      callback(null, true);
    } else {
      console.warn(`[cors] Origine refusée : ${origin}`);
      callback(new Error('Non autorisé par CORS'));
    }
  },
  methods:      ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials:  false
}));

/* ============================================================
   3. MIDDLEWARES GLOBAUX
   ============================================================ */
app.use(express.json());

/* ============================================================
   4. HEALTH CHECK
   Utilisé par Render pour vérifier que le serveur est vivant.
   GET /health → { status: "ok", ... }
   ============================================================ */
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    service: 'storvital-backend',
    time:    new Date().toISOString(),
    stripe:  !!process.env.STRIPE_SECRET_KEY
  });
});

/* ============================================================
   5. ROUTES
   ============================================================ */
app.use('/', stripeRoutes); // POST /create-checkout-session, GET /order-info
app.use('/', authRoutes);   // POST /create-account, POST /login
app.use('/', orderRoutes);  // POST /track-order

/* ============================================================
   6. GESTION DES ERREURS 404
   ============================================================ */
app.use((req, res) => {
  res.status(404).json({ error: `Route inconnue : ${req.method} ${req.path}` });
});

/* ============================================================
   7. GESTION GLOBALE DES ERREURS
   ============================================================ */
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[server] Erreur non gérée :', err.message);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

/* ============================================================
   8. DÉMARRAGE
   ============================================================ */
initDataFiles(); // Crée data/ + fichiers JSON si absents

app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║         🌿  STORVITAL BACKEND  🌿                ║');
  console.log(`║  Port          : ${PORT}                              ║`);
  console.log(`║  Environnement : ${(process.env.NODE_ENV || 'development').padEnd(30)}║`);
  console.log(`║  Stripe        : ${process.env.STRIPE_SECRET_KEY ? '✅ Clé configurée       ' : '❌ STRIPE_SECRET_KEY manquante'}       ║`);
  console.log(`║  Front autorisé: ${FRONTEND_URL.substring(0, 30).padEnd(30)}║`);
  console.log('╚══════════════════════════════════════════════════╝\n');
  console.log('  Routes disponibles :');
  console.log('  GET  /health');
  console.log('  POST /create-checkout-session');
  console.log('  GET  /order-info');
  console.log('  POST /create-account');
  console.log('  POST /login');
  console.log('  POST /track-order');
  console.log('  POST /webhook\n');
});

module.exports = app;
