import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { signToken } from '../middleware/auth.js';

export const register = async (req, res, next) => {
  try {
    const { fullName, email, password, phone } = req.body;
    const existing = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);

    if (existing[0].length) {
      return res.status(409).json({ success: false, message: 'This email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (role_id, full_name, email, password_hash, phone, status) VALUES (?, ?, ?, ?, ?, ?)',
      [2, fullName, email, passwordHash, phone || null, 'active']
    );

    const user = { id: result.insertId, role_id: 2, full_name: fullName, email, phone };
    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: 'user',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'This account is suspended.' });
    }

    const token = signToken(user);
    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role_id === 1 ? 'admin' : 'user',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res) => {
  const role = req.user.roleId === 1 ? 'admin' : 'user';
  return res.json({
    success: true,
    user: {
      id: req.user.id,
      fullName: req.user.fullName,
      email: req.user.email,
      phone: req.user.phone,
      role,
    },
  });
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!passwordMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    next(error);
  }
};

export const logout = async (_req, res) => {
  return res.json({ success: true, message: 'Logged out successfully.' });
};
