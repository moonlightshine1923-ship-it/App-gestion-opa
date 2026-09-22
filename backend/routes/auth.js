import express from 'express';
import bcrypt from 'bcryptjs';
import { get, run } from '../db.js';
import { signToken, authenticate, resolveUserPermissions } from '../middleware/auth.js';
import { logAction } from '../audit.js';
import { notifyUserLogin, notifyPasswordChanged } from '../email.js';

const router = express.Router();
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;

function loginKey(req, email = '') {
  return `${req.ip || 'ip'}::${String(email).toLowerCase().trim()}`;
}

function canAttemptLogin(req, email) {
  const key = loginKey(req, email);
  const state = loginAttempts.get(key);
  if (!state) return { ok: true, key };
  if (state.count < MAX_LOGIN_ATTEMPTS) return { ok: true, key };
  if (Date.now() - state.lastAttempt > LOGIN_BLOCK_MS) {
    loginAttempts.delete(key);
    return { ok: true, key };
  }
  const waitSec = Math.ceil((LOGIN_BLOCK_MS - (Date.now() - state.lastAttempt)) / 1000);
  return { ok: false, key, waitSec };
}

function recordLoginFailure(key) {
  const state = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
  state.count += 1;
  state.lastAttempt = Date.now();
  loginAttempts.set(key, state);
}

function clearLoginFailures(key) {
  loginAttempts.delete(key);
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });

    const gate = canAttemptLogin(req, email);
    if (!gate.ok) {
      return res.status(429).json({ error: `Trop de tentatives. Réessayez dans ${gate.waitSec} secondes.` });
    }

    const user = await get('SELECT * FROM users WHERE email = ?', [String(email).toLowerCase().trim()]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      recordLoginFailure(gate.key);
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    clearLoginFailures(gate.key);
    const permissions = resolveUserPermissions(user);
    const token = signToken({ ...user, permissions });
    req.user = { id: user.id, email: user.email, role: user.role };
    await logAction(req, 'LOGIN', `Connexion de l'utilisateur ${user.email}`);
    
    // Notification par email
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
    await notifyUserLogin({ userEmail: user.email, userRole: user.role, ip: clientIp });

    res.json({ token, user: { id: user.id, email: user.email, role: user.role, permissions } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await get('SELECT id, email, role, permissions FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ user: { ...user, permissions: resolveUserPermissions(user) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/change-password', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'saisie') {
      return res.status(403).json({ error: "Ce compte n'est pas autorisé à changer son mot de passe." });
    }

    const { current, next } = req.body || {};
    if (!current || !next) return res.status(400).json({ error: 'Champs requis.' });
    if (String(next).length < 6) return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum.' });

    const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!bcrypt.compareSync(current, user.password_hash)) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
    }
    const hash = bcrypt.hashSync(next, 10);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
    await logAction(req, 'CHANGE_PASSWORD', `Changement de mot de passe par l'utilisateur ${req.user.email}`);
    
    // Notification par email
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
    await notifyPasswordChanged({ userEmail: req.user.email, changedByEmail: req.user.email, ip: clientIp, isResetByAdmin: false });

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

