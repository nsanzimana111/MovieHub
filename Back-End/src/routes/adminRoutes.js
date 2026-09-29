import express from 'express';
import { dashboardStats, getAuditLogs, getAllUsers, updateUserStatus } from '../controllers/adminController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/dashboard', authenticate, authorize('admin'), dashboardStats);
router.get('/users', authenticate, authorize('admin'), getAllUsers);
router.patch('/users/:id/status', authenticate, authorize('admin'), updateUserStatus);
router.get('/audit-logs', authenticate, authorize('admin'), getAuditLogs);

export default router;
