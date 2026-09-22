import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.OPA_SECRET || 'opa-secret-key-change-in-production';
export const AVAILABLE_PERMISSIONS = [
  'adherents_add',
  'adherents_manage',
  'demandes_view',
  'demandes_edit',
  'documents_view',
];

export function normalizePermissions(input) {
  let list = [];

  if (Array.isArray(input)) {
    list = input;
  } else if (typeof input === 'string' && input.trim()) {
    try {
      const parsed = JSON.parse(input);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = input.split(',');
    }
  }

  return [...new Set(list.map((x) => String(x || '').trim()).filter(Boolean))]
    .filter((x) => AVAILABLE_PERMISSIONS.includes(x));
}

export function resolveUserPermissions(user = {}) {
  if (user.role === 'admin' || user.role === 'president') return AVAILABLE_PERMISSIONS.slice();
  const perms = normalizePermissions(user.permissions);
  if (!perms.length && user.role === 'saisie') return ['adherents_add'];
  return perms;
}

export function hasPermission(user, permission) {
  if (!permission) return true;
  const perms = resolveUserPermissions(user);
  if (perms.includes(permission)) return true;
  if (permission === 'demandes_view' && perms.includes('demandes_edit')) return true;
  if (permission === 'adherents_add' && perms.includes('adherents_manage')) return true;
  return false;
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, permissions: resolveUserPermissions(user) },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);

  if (!token) return res.status(401).json({ error: 'Authentification requise.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    req.user.permissions = resolveUserPermissions(req.user);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expirée ou invalide.' });
  }
}

export function authorize(...rules) {
  return (req, res, next) => {
    if (!rules.length) return next();

    const roles = rules.filter((r) => !String(r).startsWith('perm:'));
    const perms = rules.filter((r) => String(r).startsWith('perm:')).map((r) => String(r).slice(5));

    const roleOk = roles.includes(req.user.role);
    const permOk = perms.some((p) => hasPermission(req.user, p));

    if (!roleOk && !permOk) {
      return res.status(403).json({ error: 'Accès refusé pour votre rôle.' });
    }
    next();
  };
}