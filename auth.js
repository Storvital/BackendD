/* ============================================================
   routes/auth.js
   Routes d'authentification client : création de compte + login
   ============================================================ */

const express = require('express');
const router  = express.Router();
const { createAccount, login } = require('../controllers/authController');

// Création d'un nouveau compte client
router.post('/create-account', createAccount);

// Connexion client
router.post('/login', login);

module.exports = router;
