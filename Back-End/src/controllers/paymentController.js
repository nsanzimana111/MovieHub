import { pool } from '../config/db.js';
import { makeOrderReference } from '../utils/helpers.js';

export const createOrder = async (req, res, next) => {
  try {
    const { movieId } = req.body;
    const [movieRows] = await pool.execute('SELECT * FROM movies WHERE id = ? AND status = ?', [movieId, 'published']);

    if (!movieRows.length) {
      return res.status(404).json({ success: false, message: 'Movie not found or not available for purchase.' });
    }

    const movie = movieRows[0];
    const [purchaseRows] = await pool.execute(
      'SELECT id FROM purchases WHERE user_id = ? AND movie_id = ? AND status = \'active\' LIMIT 1',
      [req.user.id, movieId]
    );
    if (purchaseRows.length) {
      return res.status(409).json({ success: false, message: 'You already own this movie.' });
    }

    const [settingsRows] = await pool.execute(
      'SELECT provider_name, payment_phone_number, account_name, instructions, currency FROM payment_settings WHERE is_active = TRUE ORDER BY id DESC LIMIT 1'
    );
    if (!settingsRows.length) {
      return res.status(503).json({ success: false, message: 'Payments are not currently configured. Please contact the administrator.' });
    }

    await pool.execute(
      'UPDATE payment_orders SET status = \'expired\' WHERE user_id = ? AND movie_id = ? AND status = \'pending\' AND expires_at <= NOW()',
      [req.user.id, movieId]
    );

    const [existingOrder] = await pool.execute(
      'SELECT id FROM payment_orders WHERE user_id = ? AND movie_id = ? AND status IN (\'pending\',\'submitted\',\'approved\') ORDER BY created_at DESC LIMIT 1',
      [req.user.id, movieId]
    );

    if (existingOrder.length) {
      return res.status(409).json({ success: false, message: 'You already have an active order for this movie.' });
    }

    const orderReference = makeOrderReference();
    const [result] = await pool.execute(
      'INSERT INTO payment_orders (user_id, movie_id, order_reference, amount_rwf, currency, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
      [req.user.id, movieId, orderReference, Number(movie.price_rwf), 'RWF', 'pending']
    );

    return res.status(201).json({
      success: true,
      order: {
        id: result.insertId,
        orderReference,
        movieId,
        movieTitle: movie.title,
        amountRwf: Number(movie.price_rwf),
        currency: 'RWF',
        status: 'pending',
        paymentSettings: settingsRows[0],
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyOrders = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT po.*, m.title AS movie_title, m.poster_path
        , (SELECT ps.id FROM payment_submissions ps WHERE ps.payment_order_id = po.id ORDER BY ps.created_at DESC LIMIT 1) AS latest_submission_id
        , (SELECT ps.status FROM payment_submissions ps WHERE ps.payment_order_id = po.id ORDER BY ps.created_at DESC LIMIT 1) AS latest_submission_status
        , (SELECT ps.rejection_reason FROM payment_submissions ps WHERE ps.payment_order_id = po.id ORDER BY ps.created_at DESC LIMIT 1) AS rejection_reason
       FROM payment_orders po
       LEFT JOIN movies m ON m.id = po.movie_id
       WHERE po.user_id = ?
       ORDER BY po.created_at DESC`,
      [req.user.id]
    );

    return res.json({ success: true, orders: rows });
  } catch (error) {
    next(error);
  }
};

export const submitPayment = async (req, res, next) => {
  try {
    const { transactionReference, senderPhone, submittedAmountRwf, notes } = req.body;
    const orderId = req.params.id;

    const [orderRows] = await pool.execute('SELECT * FROM payment_orders WHERE id = ? AND user_id = ?', [orderId, req.user.id]);
    if (!orderRows.length) {
      return res.status(404).json({ success: false, message: 'Payment order not found.' });
    }

    const order = orderRows[0];
    if (order.status !== 'pending' || (order.expires_at && new Date(order.expires_at) <= new Date())) {
      if (order.status === 'pending' && order.expires_at && new Date(order.expires_at) <= new Date()) {
        await pool.execute('UPDATE payment_orders SET status = \'expired\' WHERE id = ?', [order.id]);
      }
      return res.status(400).json({ success: false, message: 'This order is no longer open for payment submission.' });
    }

    const amount = Number(submittedAmountRwf);
    if (!transactionReference?.trim() && !notes?.trim()) {
      return res.status(400).json({ success: false, message: 'Enter a transaction reference or payment proof details.' });
    }
    if (!Number.isFinite(amount) || amount !== Number(order.amount_rwf)) {
      return res.status(400).json({ success: false, message: 'The submitted amount must match the order amount.' });
    }

    await pool.execute(
      `INSERT INTO payment_submissions (payment_order_id, user_id, transaction_reference, sender_phone, submitted_amount_rwf, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [order.id, req.user.id, transactionReference?.trim() || null, senderPhone?.trim() || null, amount, notes?.trim() || null]
    );

    await pool.execute('UPDATE payment_orders SET status = ? WHERE id = ?', ['submitted', order.id]);

    return res.json({ success: true, message: 'Payment submission received and awaiting verification.' });
  } catch (error) {
    next(error);
  }
};

export const getAdminPaymentOrders = async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT po.*, u.full_name AS user_name, m.title AS movie_title,
      (SELECT ps.id FROM payment_submissions ps WHERE ps.payment_order_id = po.id ORDER BY ps.created_at DESC LIMIT 1) AS latest_submission_id,
      (SELECT ps.status FROM payment_submissions ps WHERE ps.payment_order_id = po.id ORDER BY ps.created_at DESC LIMIT 1) AS latest_submission_status,
      (SELECT ps.transaction_reference FROM payment_submissions ps WHERE ps.payment_order_id = po.id ORDER BY ps.created_at DESC LIMIT 1) AS transaction_reference,
      (SELECT ps.submitted_amount_rwf FROM payment_submissions ps WHERE ps.payment_order_id = po.id ORDER BY ps.created_at DESC LIMIT 1) AS submitted_amount_rwf,
      (SELECT ps.sender_phone FROM payment_submissions ps WHERE ps.payment_order_id = po.id ORDER BY ps.created_at DESC LIMIT 1) AS sender_phone,
      (SELECT ps.notes FROM payment_submissions ps WHERE ps.payment_order_id = po.id ORDER BY ps.created_at DESC LIMIT 1) AS submission_notes
       FROM payment_orders po
       JOIN users u ON u.id = po.user_id
       JOIN movies m ON m.id = po.movie_id
       ORDER BY po.created_at DESC`
    );

    return res.json({ success: true, orders: rows });
  } catch (error) {
    next(error);
  }
};

export const getAdminPaymentSubmission = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ps.*, po.order_reference, po.amount_rwf, po.status AS order_status,
       u.full_name AS user_name, m.title AS movie_title
       FROM payment_submissions ps
       JOIN payment_orders po ON po.id = ps.payment_order_id
       JOIN users u ON u.id = ps.user_id
       JOIN movies m ON m.id = po.movie_id
       WHERE ps.id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Payment submission not found.' });
    }

    return res.json({ success: true, submission: rows[0] });
  } catch (error) {
    next(error);
  }
};

export const approvePayment = async (req, res, next) => {
  try {
    const submissionId = req.params.id;
    const [submissionRows] = await pool.execute('SELECT * FROM payment_submissions WHERE id = ?', [submissionId]);
    if (!submissionRows.length) {
      return res.status(404).json({ success: false, message: 'Payment submission not found.' });
    }

    const submission = submissionRows[0];
    const [orderRows] = await pool.execute('SELECT * FROM payment_orders WHERE id = ?', [submission.payment_order_id]);
    if (!orderRows.length) {
      return res.status(404).json({ success: false, message: 'Payment order not found.' });
    }

    const order = orderRows[0];
    if (submission.status !== 'pending' || !['pending', 'submitted'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'This payment submission is no longer pending review.' });
    }
    if (Number(submission.submitted_amount_rwf) !== Number(order.amount_rwf)) {
      return res.status(400).json({ success: false, message: 'Submitted amount does not match the order amount. Reject this submission.' });
    }

    const [existingPurchase] = await pool.execute(
      'SELECT id FROM purchases WHERE user_id = ? AND movie_id = ? AND status = ? LIMIT 1',
      [submission.user_id, order.movie_id, 'active']
    );

    if (existingPurchase.length) {
      return res.status(409).json({ success: false, message: 'This user already has an active purchase for this movie.' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('UPDATE payment_submissions SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?', ['approved', req.user.id, submissionId]);
      await connection.execute('UPDATE payment_orders SET status = ? WHERE id = ?', ['approved', order.id]);
      await connection.execute(
        'INSERT INTO purchases (user_id, movie_id, payment_order_id, payment_submission_id, amount_paid_rwf, status) VALUES (?, ?, ?, ?, ?, ?)',
        [submission.user_id, order.movie_id, order.id, submission.id, Number(submission.submitted_amount_rwf), 'active']
      );
      await connection.execute(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'payment_approved', 'payment_submission', submission.id, `Approved payment submission for order ${order.order_reference}`]
      );
      await connection.commit();
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

    return res.json({ success: true, message: 'Payment approved and purchase activated.' });
  } catch (error) {
    next(error);
  }
};

export const rejectPayment = async (req, res, next) => {
  try {
    const { rejectionReason } = req.body;
    const submissionId = req.params.id;
    const [rows] = await pool.execute('SELECT * FROM payment_submissions WHERE id = ?', [submissionId]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Payment submission not found.' });
    }
    if (rows[0].status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This payment submission has already been reviewed.' });
    }

    await pool.execute(
      'UPDATE payment_submissions SET status = ?, reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ? WHERE id = ?',
      ['rejected', req.user.id, rejectionReason || 'Payment rejected by admin.', submissionId]
    );
    await pool.execute('UPDATE payment_orders SET status = ? WHERE id = ?', ['rejected', rows[0].payment_order_id]);

    await pool.execute(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'payment_rejected', 'payment_submission', submissionId, rejectionReason || 'Payment rejected by admin.']
    );

    return res.json({ success: true, message: 'Payment rejected.' });
  } catch (error) {
    next(error);
  }
};

export const getPaymentSettings = async (_req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM payment_settings WHERE is_active = TRUE ORDER BY id DESC LIMIT 1');
    return res.json({ success: true, settings: rows[0] || null });
  } catch (error) {
    next(error);
  }
};

export const getAdminPaymentSettings = async (_req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM payment_settings ORDER BY id DESC LIMIT 1');
    return res.json({ success: true, settings: rows[0] || null });
  } catch (error) {
    next(error);
  }
};

export const updatePaymentSettings = async (req, res, next) => {
  try {
    const { providerName, paymentPhoneNumber, accountName, instructions, currency, isActive } = req.body;
    if (!providerName?.trim() || !paymentPhoneNumber?.trim()) {
      return res.status(400).json({ success: false, message: 'Payment provider and telephone number are required.' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('UPDATE payment_settings SET is_active = FALSE WHERE is_active = TRUE');
      await connection.execute(
        `INSERT INTO payment_settings (provider_name, payment_phone_number, account_name, instructions, currency, is_active, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [providerName.trim(), paymentPhoneNumber.trim(), accountName?.trim() || null, instructions?.trim() || null, currency || 'RWF', isActive !== false, req.user.id]
      );
      await connection.commit();
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

    return res.json({ success: true, message: 'Payment settings updated successfully.' });
  } catch (error) {
    next(error);
  }
};

export const getMyPurchases = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, m.title AS movie_title, m.poster_path, po.order_reference
       FROM purchases p
       JOIN movies m ON m.id = p.movie_id
       JOIN payment_orders po ON po.id = p.payment_order_id
       WHERE p.user_id = ? AND p.status = 'active'
       ORDER BY p.purchased_at DESC`,
      [req.user.id]
    );

    return res.json({ success: true, purchases: rows });
  } catch (error) {
    next(error);
  }
};

export const getAllPurchasesAdmin = async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, u.full_name AS user_name, m.title AS movie_title
       FROM purchases p
       JOIN users u ON u.id = p.user_id
       JOIN movies m ON m.id = p.movie_id
       ORDER BY p.purchased_at DESC`
    );

    return res.json({ success: true, purchases: rows });
  } catch (error) {
    next(error);
  }
};

export const revokePurchase = async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute('SELECT id, status FROM purchases WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!rows.length) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Purchase not found.' });
      }
      if (rows[0].status !== 'active') {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'This purchase is already revoked.' });
      }
      await connection.execute('UPDATE purchases SET status = \'revoked\' WHERE id = ?', [req.params.id]);
      await connection.execute(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'purchase_revoked', 'purchase', req.params.id, 'Admin revoked purchase access.']
      );
      await connection.commit();
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }
    return res.json({ success: true, message: 'Purchase access revoked.' });
  } catch (error) {
    next(error);
  }
};
