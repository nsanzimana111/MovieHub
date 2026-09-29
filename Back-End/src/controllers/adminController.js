import { pool } from '../config/db.js';

export const dashboardStats = async (_req, res, next) => {
  try {
    const [userRows] = await pool.execute('SELECT COUNT(*) AS total FROM users');
    const [movieRows] = await pool.execute('SELECT COUNT(*) AS total, SUM(CASE WHEN status = "published" THEN 1 ELSE 0 END) AS published FROM movies');
    const [paymentRows] = await pool.execute(
      `SELECT
        SUM(CASE WHEN po.status IN ('pending', 'submitted') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN po.status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN po.status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN po.status = 'approved' THEN po.amount_rwf ELSE 0 END) AS approved_total
       FROM payment_orders po`
    );
    const [recentUsers] = await pool.execute('SELECT id, full_name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5');
    const [recentPayments] = await pool.execute(
      `SELECT ps.*, u.full_name, po.order_reference, m.title AS movie_title
       FROM payment_submissions ps
       JOIN users u ON u.id = ps.user_id
       JOIN payment_orders po ON po.id = ps.payment_order_id
       JOIN movies m ON m.id = po.movie_id
       ORDER BY ps.created_at DESC LIMIT 5`
    );

    return res.json({
      success: true,
      stats: {
        totalUsers: Number(userRows[0].total),
        totalMovies: Number(movieRows[0].total),
        publishedMovies: Number(movieRows[0].published),
        pendingPayments: Number(paymentRows[0].pending),
        approvedPayments: Number(paymentRows[0].approved),
        rejectedPayments: Number(paymentRows[0].rejected),
        totalApprovedPurchaseAmount: Number(paymentRows[0].approved_total || 0),
      },
      recentUsers,
      recentPayments,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at, r.name AS role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ORDER BY u.created_at DESC`
    );

    return res.json({ success: true, users: rows });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be active or suspended.' });
    }
    if (Number(req.params.id) === Number(req.user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot change your own account status.' });
    }
    await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
    return res.json({ success: true, message: 'User status updated.' });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT al.*, u.full_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC LIMIT 100`
    );

    return res.json({ success: true, logs: rows });
  } catch (error) {
    next(error);
  }
};
