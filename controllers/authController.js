/* ============================================================
   controllers/authController.js
   Création de compte client et connexion
   ============================================================ */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { getUsers, saveUsers, getOrders } = require('../utils/db');
const { isValidEmail, sanitizeUser, sanitizeOrder } = require('../utils/helpers');

const BCRYPT_ROUNDS = 12;

/* ------------------------------------------------------------------
   POST /create-account
   Crée un nouveau compte client.
   Stocke : id, email (normalisé), passwordHash (bcrypt), prénom, nom, createdAt
   ------------------------------------------------------------------ */
async function createAccount(req, res) {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validation des champs obligatoires
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const emailNorm = email.toLowerCase().trim();
    const users     = getUsers();

    // Vérifier unicité email
    if (users.find(u => u.email === emailNorm)) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse email.' });
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const newUser = {
      id:           crypto.randomUUID(),
      email:        emailNorm,
      passwordHash,
      firstName:    (firstName || '').trim(),
      lastName:     (lastName  || '').trim(),
      createdAt:    new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    console.log(`[auth] Nouveau compte créé : ${emailNorm}`);
    res.status(201).json({ success: true, user: sanitizeUser(newUser) });

  } catch (err) {
    console.error('[auth] createAccount :', err.message);
    res.status(500).json({ error: 'Erreur serveur lors de la création du compte.' });
  }
}

/* ------------------------------------------------------------------
   POST /login
   Authentifie un client. Retourne l'utilisateur + ses commandes.
   Protection anti-timing attack : bcrypt est toujours appelé,
   même si l'utilisateur n'existe pas.
   ------------------------------------------------------------------ */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const emailNorm = email.toLowerCase().trim();
    const users     = getUsers();
    const user      = users.find(u => u.email === emailNorm);

    // Anti-timing : on hash toujours quelque chose
    const hashToCompare = user?.passwordHash
      || '$2b$12$invalidhashpaddingtopreventimengingatttackXXXXXXXXXXXX';

    const valid = await bcrypt.compare(password, hashToCompare);

    if (!user || !valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    // Récupérer les commandes de cet utilisateur (sans stripeSessionId)
    const orders = getOrders()
      .filter(o => o.email === user.email)
      .map(sanitizeOrder)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`[auth] Connexion : ${emailNorm}`);
    res.json({ success: true, user: sanitizeUser(user), orders });

  } catch (err) {
    console.error('[auth] login :', err.message);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion.' });
  }
}

module.exports = { createAccount, login };
