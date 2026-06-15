/* ============================================================
   controllers/stripeController.js
   Logique Stripe Checkout et récupération de commande
   ============================================================ */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getOrders, saveOrders } = require('../utils/db');
const { generateOrderId, validateCartItems, sanitizeOrder } = require('../utils/helpers');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

/* ------------------------------------------------------------------
   POST /create-checkout-session
   Crée une session Stripe Checkout dynamiquement depuis le panier.
   Aucun produit ne doit exister dans Stripe au préalable.
   ------------------------------------------------------------------ */
async function createCheckoutSession(req, res) {
  try {
    const { items, userEmail } = req.body;

    // Validation du panier
    const validationError = validateCartItems(items);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // Construction des line_items Stripe (100% dynamique)
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name,
          description: `Cure ${item.variant === '2m' ? '2 mois' : '1 mois'} — Storvital`,
          images: item.image ? [item.image] : [],
          metadata: {
            product_id: item.id   || '',
            variant:    item.variant || '1m'
          }
        },
        unit_amount: Math.round(item.price * 100) // Stripe attend des centimes
      },
      quantity: Math.max(1, parseInt(item.quantity, 10))
    }));

    // Pré-générer le numéro de commande AVANT la session Stripe
    const pendingOrderId = generateOrderId();

    // Création de la session Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types:        ['card'],
      line_items:                  lineItems,
      mode:                        'payment',
      customer_email:              userEmail || undefined,
      billing_address_collection:  'required',
      shipping_address_collection: { allowed_countries: ['FR'] },
      shipping_options: [{
        shipping_rate_data: {
          type:         'fixed_amount',
          fixed_amount: { amount: 0, currency: 'eur' },
          display_name: 'Livraison offerte — Colissimo',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 2 },
            maximum: { unit: 'business_day', value: 5 }
          }
        }
      }],
      locale:   'fr',
      metadata: { order_id: pendingOrderId },
      success_url: `${FRONTEND_URL}/success.html?session_id={CHECKOUT_SESSION_ID}&order_id=${pendingOrderId}`,
      cancel_url:  `${FRONTEND_URL}/cancel.html`
    });

    // Enregistrement de la commande en base (statut initial)
    const orders = getOrders();
    orders.push({
      id:              pendingOrderId,
      stripeSessionId: session.id,
      status:          'En préparation',
      items,
      total:           items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      email:           userEmail || null,
      customerName:    null,
      shippingAddress: null,
      paidAt:          null,
      createdAt:       new Date().toISOString()
    });
    saveOrders(orders);

    console.log(`[stripe] Session créée : ${session.id} | Commande : ${pendingOrderId}`);
    res.json({ url: session.url });

  } catch (err) {
    console.error('[stripe] createCheckoutSession :', err.message);
    res.status(500).json({ error: err.message });
  }
}

/* ------------------------------------------------------------------
   GET /order-info?order_id=SV-XXX  ou  ?session_id=cs_xxx
   Récupère les détails d'une commande pour la page success.html.
   Si les infos client manquent, les récupère depuis Stripe.
   ------------------------------------------------------------------ */
async function getOrderInfo(req, res) {
  try {
    const { session_id, order_id } = req.query;

    if (!session_id && !order_id) {
      return res.status(400).json({ error: 'Paramètre order_id ou session_id requis.' });
    }

    const orders = getOrders();
    let order = order_id
      ? orders.find(o => o.id === order_id)
      : orders.find(o => o.stripeSessionId === session_id);

    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

    // Enrichir depuis Stripe si infos client manquantes
    if (session_id && (!order.email || !order.customerName)) {
      try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        if (session.payment_status === 'paid') {
          order.email          = session.customer_details?.email   || order.email;
          order.customerName   = session.customer_details?.name    || order.customerName;
          order.shippingAddress = session.shipping_details?.address || order.shippingAddress;
          order.status         = 'En préparation';
          order.paidAt         = order.paidAt || new Date().toISOString();
          saveOrders(orders);
        }
      } catch (stripeErr) {
        console.warn('[stripe] Impossible de récupérer la session :', stripeErr.message);
      }
    }

    res.json({ success: true, order: sanitizeOrder(order) });

  } catch (err) {
    console.error('[stripe] getOrderInfo :', err.message);
    res.status(500).json({ error: err.message });
  }
}

/* ------------------------------------------------------------------
   POST /webhook
   Reçoit les événements Stripe (checkout.session.completed).
   Met à jour le statut de la commande en base.
   IMPORTANT : doit être enregistré AVANT express.json() dans server.js
   ------------------------------------------------------------------ */
async function handleWebhook(req, res) {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.warn('[webhook] STRIPE_WEBHOOK_SECRET non configuré — webhook ignoré.');
    return res.json({ received: true });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[webhook] Signature invalide :', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orders  = getOrders();
    const order   = orders.find(o => o.stripeSessionId === session.id);

    if (order) {
      order.status          = 'En préparation';
      order.paidAt          = new Date().toISOString();
      order.email           = session.customer_details?.email   || order.email;
      order.customerName    = session.customer_details?.name    || order.customerName;
      order.shippingAddress = session.shipping_details?.address || order.shippingAddress;
      saveOrders(orders);
      console.log(`[webhook] Commande confirmée : ${order.id}`);
    } else {
      console.warn(`[webhook] Aucune commande trouvée pour session : ${session.id}`);
    }
  }

  res.json({ received: true });
}

module.exports = { createCheckoutSession, getOrderInfo, handleWebhook };
