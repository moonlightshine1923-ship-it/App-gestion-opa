import express from 'express';
import bcrypt from 'bcryptjs';
import { get, query, run } from '../db.js';
import { authenticate, authorize, normalizePermissions } from '../middleware/auth.js';
import { logAction } from '../audit.js';
import { notifyUserCreated, notifyPasswordChanged } from '../email.js';

const router = express.Router();
const ROLES = ['admin', 'president', 'saisie'];

async function assertNotPresidentTarget(req, res, { allowSelf = false } = {}) {
  const target = await get('SELECT id, email, role, permissions FROM users WHERE id = ?', [req.params.id]);
  if (!target) {
    res.status(404).json({ error: 'Compte introuvable.' });
    return null;
  }
  if (target.role === 'president') {
    if (!(allowSelf && req.user.role === 'president' && req.user.id === target.id)) {
      res.status(403).json({ error: 'Le compte Président est protégé : seul le Président peut modifier ses informations.' });
      return null;
    }
  }
  return target;
}

router.get('/', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const rows = await query('SELECT id, email, role, permissions, created_at FROM users ORDER BY id');
    res.json(rows.map((u) => ({ ...u, permissions: normalizePermissions(u.permissions) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const { email, password, role, permissions } = req.body || {};
    const effectiveRole = role || 'saisie';
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
    if (!ROLES.includes(effectiveRole)) return res.status(400).json({ error: 'Rôle invalide.' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum.' });
    if (effectiveRole === 'president' && req.user.role !== 'president') {
      return res.status(403).json({ error: 'Seul le Président peut créer un nouveau compte Président.' });
    }

    const normalizedPermissions = normalizePermissions(permissions);
    if (effectiveRole === 'saisie' && !normalizedPermissions.length) {
      return res.status(400).json({ error: 'Choisissez au moins un accès.' });
    }

    const exists = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (exists) return res.status(409).json({ error: 'Cet email est déjà utilisé.' });

    const hash = bcrypt.hashSync(password, 10);
    const serializedPermissions = normalizedPermissions.length ? JSON.stringify(normalizedPermissions) : null;
    const r = await run('INSERT INTO users (email, password_hash, role, permissions) VALUES (?,?,?,?)', [email.toLowerCase().trim(), hash, effectiveRole, serializedPermissions]);
    await logAction(req, 'CREATE_USER', `Création du compte utilisateur : ${email} (Rôle: ${effectiveRole})`, r.insertId, 'user');
    
    // Notification par email
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
    await notifyUserCreated({
      createdUserEmail: email.toLowerCase().trim(),
      createdUserRole: effectiveRole,
      createdByEmail: req.user.email,
      ip: clientIp
    });

    res.status(201).json({ id: r.insertId, email: email.toLowerCase().trim(), role: effectiveRole, permissions: normalizedPermissions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/role', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const target = await assertNotPresidentTarget(req, res);
    if (!target) return;
    const { role, permissions } = req.body || {};
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Rôle invalide.' });
    if (role === 'president' && req.user.role !== 'president') {
      return res.status(403).json({ error: 'Seul le Président peut attribuer le rôle Président.' });
    }
    const normalizedPermissions = normalizePermissions(permissions);
    await run('UPDATE users SET role = ?, permissions = ? WHERE id = ?', [role, normalizedPermissions.length ? JSON.stringify(normalizedPermissions) : null, target.id]);
    await logAction(req, 'EDIT_USER_ROLE', `Mise à jour du rôle/permissions de l'utilisateur ${target.email} (Nouveau rôle: ${role})`, target.id, 'user');
    res.json({ ok: true, permissions: normalizedPermissions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/password', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const target = await assertNotPresidentTarget(req, res);
    if (!target) return;
    const { password } = req.body || {};
    if (!password || String(password).length < 6) return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum.' });
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(password, 10), target.id]);
    await logAction(req, 'EDIT_USER_PASSWORD', `Réinitialisation du mot de passe de l'utilisateur ${target.email}`, target.id, 'user');
    
    // Notification par email
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
    await notifyPasswordChanged({
      userEmail: target.email,
      changedByEmail: req.user.email,
      ip: clientIp,
      isResetByAdmin: true
    });

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const target = await assertNotPresidentTarget(req, res);
    if (!target) return;
    if (parseInt(req.params.id, 10) === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }
    const r = await run('DELETE FROM users WHERE id = ?', [target.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Compte introuvable.' });
    await logAction(req, 'DELETE_USER', `Suppression de l'utilisateur ${target.email}`, target.id, 'user');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
