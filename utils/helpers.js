/* ============================================================
   utils/helpers.js
   Fonctions utilitaires partagées entre les controllers
   ============================================================ */

const crypto = require('crypto');

/**
 * Génère un identifiant de commande unique au format SV-XXXXX-XXXX.
 * Exemple : SV-M9K3B1A2-4F2E
 */
function generateOrderId() {
  const ts  = Date.now().toString(36).toUpperCase();   // timestamp base36
  const rnd = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 chars aléatoires
  return `SV-${ts}-${rnd}`;
}

/**
 * Valide le format d'un email.
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Supprime le champ passwordHash d'un objet utilisateur
 * avant de le renvoyer au client.
 */
function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

/**
 * Supprime le champ stripeSessionId d'une commande
 * avant de la renvoyer au client.
 */
function sanitizeOrder(order) {
  const { stripeSessionId, ...safe } = order;
  return safe;
}

/**
 * Valide les articles du panier reçus du front.
 * Retourne null si valide, ou un message d'erreur.
 */
function validateCartItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Le panier est vide ou invalide.';
  }
  for (const item of items) {
    if (!item.name || typeof item.name !== 'string') return 'Nom d\'article invalide.';
    if (!item.price || typeof item.price !== 'number' || item.price <= 0) return 'Prix invalide.';
    if (!item.quantity || typeof item.quantity !== 'number' || item.quantity < 1) return 'Quantité invalide.';
  }
  return null;
}

module.exports = {
  generateOrderId,
  isValidEmail,
  sanitizeUser,
  sanitizeOrder,
  validateCartItems
};
