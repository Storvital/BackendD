/* ============================================================
   routes/orders.js
   Route de suivi de commande (email + numéro de commande)
   ============================================================ */

const express = require('express');
const router  = express.Router();
const { trackOrder } = require('../controllers/orderController');

// Suivi d'une commande par email + numéro
router.post('/track-order', trackOrder);

module.exports = router;
