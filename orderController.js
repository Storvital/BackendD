/* ============================================================
   controllers/orderController.js
   Suivi de commande par email + numéro de commande
   ============================================================ */

const { getOrders } = require('../utils/db');
const { sanitizeOrder } = require('../utils/helpers');

/* ------------------------------------------------------------------
   POST /track-order
   Corps attendu : { email: string, orderId: string }
   Retourne la commande si email + orderId correspondent.
   ------------------------------------------------------------------ */
function trackOrder(req, res) {
  try {
    const { email, orderId } = req.body;

    if (!email || !orderId) {
      return res.status(400).json({ error: 'Email et numéro de commande requis.' });
    }

    const emailNorm  = email.toLowerCase().trim();
    const orderIdNorm = orderId.trim().toUpperCase();

    const orders = getOrders();
    const order  = orders.find(o =>
      o.id === orderIdNorm &&
      o.email?.toLowerCase() === emailNorm
    );

    if (!order) {
      return res.status(404).json({
        error: 'Commande introuvable. Vérifiez votre email et votre numéro de commande (format SV-XXXXX-XXXX).'
      });
    }

    res.json({ success: true, order: sanitizeOrder(order) });

  } catch (err) {
    console.error('[orders] trackOrder :', err.message);
    res.status(500).json({ error: 'Erreur serveur lors de la recherche de commande.' });
  }
}

module.exports = { trackOrder };
