import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication token is required.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'moviehub-dev-secret');
    const [rows] = await pool.execute('SELECT id, role_id, full_name, email, phone, status FROM users WHERE id = ?', [decoded.userId]);

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'User account not found.' });
    }

    const user = rows[0];
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account is suspended.' });
    }

    req.user = {
      id: user.id,
      roleId: user.role_id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

export const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const roles = allowedRoles.map((role) => String(role).toLowerCase());
  const userRole = req.user.roleId === 1 ? 'admin' : 'user';

  if (!roles.includes(userRole)) {
    return res.status(403).json({ success: false, message: 'You are not allowed to access this resource.' });
  }

  next();
};

export const signToken = (user) =>
  jwt.sign(
    { userId: user.id, email: user.email, roleId: user.role_id },
    process.env.JWT_SECRET || 'moviehub-dev-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
