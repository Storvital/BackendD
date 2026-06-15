/* ============================================================
   utils/db.js
   Utilitaires de lecture / écriture des fichiers JSON
   (users.json et orders.json font office de base de données)
   ============================================================ */

const fs   = require('fs');
const path = require('path');

const DATA_DIR    = path.join(__dirname, '..', 'data');
const USERS_FILE  = path.join(DATA_DIR, 'users.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

/**
 * Lire un fichier JSON et retourner son contenu sous forme de tableau.
 * Retourne [] en cas d'erreur ou de fichier absent.
 */
function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const content = fs.readFileSync(file, 'utf-8').trim();
    return content ? JSON.parse(content) : [];
  } catch (err) {
    console.error(`[db] Erreur lecture ${path.basename(file)} :`, err.message);
    return [];
  }
}

/**
 * Écrire un tableau dans un fichier JSON (formaté, lisible).
 * Crée le dossier data/ si nécessaire.
 */
function writeJSON(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[db] Erreur écriture ${path.basename(file)} :`, err.message);
    throw err;
  }
}

/* --- Raccourcis spécifiques aux entités Storvital --- */

function getUsers()         { return readJSON(USERS_FILE);  }
function saveUsers(users)   { writeJSON(USERS_FILE, users); }

function getOrders()        { return readJSON(ORDERS_FILE);  }
function saveOrders(orders) { writeJSON(ORDERS_FILE, orders); }

/**
 * Initialise les fichiers JSON s'ils n'existent pas encore.
 * Appelé au démarrage du serveur.
 */
function initDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE))  fs.writeFileSync(USERS_FILE,  '[]', 'utf-8');
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]', 'utf-8');
  console.log('[db] Fichiers de données vérifiés ✓');
}

module.exports = {
  getUsers, saveUsers,
  getOrders, saveOrders,
  initDataFiles
};
