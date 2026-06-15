/* ============================================================
   routes/stripe.js
   Routes Stripe : Checkout + récupération de commande
   NOTE : le webhook est monté directement dans server.js
          (il a besoin du raw body parser, avant express.json())
   ============================================================ */

const express = require('express');
const router  = express.Router();
const { createCheckoutSession, getOrderInfo } = require('../controllers/stripeController');

// Créer une session Stripe Checkout depuis le panier
router.post('/create-checkout-session', createCheckoutSession);

// Récupérer les infos d'une commande (appelé par success.html)
router.get('/order-info', getOrderInfo);

module.exports = router;
