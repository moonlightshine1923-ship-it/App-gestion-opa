import { query } from './db.js';

/**
 * Logs a user or system action into the database safely.
 * @param {object} req - Express request object to retrieve IP and current user
 * @param {string} actionType - The type of action (e.g., 'LOGIN', 'CREATE_ADHERENT', etc.)
 * @param {string} description - Human-readable description
 * @param {string|number|null} targetId - ID of the target resource
 * @param {string|null} targetType - Type of target resource ('adherent', 'user', 'blacklist', etc.)
 */
export async function logAction(req, actionType, description, targetId = null, targetType = null) {
  try {
    const userId = req?.user ? req.user.id : null;
    const userEmail = req?.user ? req.user.email : 'system';
    
    let ipAddress = '';
    if (req) {
      ipAddress = req.ip || 
                  (req.headers && typeof req.headers === 'object' ? req.headers['x-forwarded-for'] : '') || 
                  req.connection?.remoteAddress || 
                  req.socket?.remoteAddress || 
                  '';
    }
    
    await query(
      `INSERT INTO audit_logs (user_id, user_email, action_type, description, target_id, target_type, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, userEmail, actionType, description, targetId ? String(targetId) : null, targetType, ipAddress]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}
