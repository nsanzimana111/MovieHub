import express from 'express';
import { createOrder, getAdminPaymentOrders, getAdminPaymentSubmission, getMyOrders, getMyPurchases, getPaymentSettings, getAdminPaymentSettings, getAllPurchasesAdmin, approvePayment, rejectPayment, revokePurchase, submitPayment, updatePaymentSettings } from '../controllers/paymentController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/settings', getPaymentSettings);
router.post('/orders', authenticate, createOrder);
router.get('/orders/my', authenticate, getMyOrders);
router.post('/orders/:id/submit', authenticate, submitPayment);
router.get('/purchases/my', authenticate, getMyPurchases);

router.get('/admin/orders', authenticate, authorize('admin'), getAdminPaymentOrders);
router.get('/admin/submissions/:id', authenticate, authorize('admin'), getAdminPaymentSubmission);
router.patch('/admin/submissions/:id/approve', authenticate, authorize('admin'), approvePayment);
router.patch('/admin/submissions/:id/reject', authenticate, authorize('admin'), rejectPayment);
router.get('/admin/settings', authenticate, authorize('admin'), getAdminPaymentSettings);
router.put('/admin/settings', authenticate, authorize('admin'), updatePaymentSettings);
router.get('/admin/purchases', authenticate, authorize('admin'), getAllPurchasesAdmin);
router.patch('/admin/purchases/:id/revoke', authenticate, authorize('admin'), revokePurchase);

export default router;
