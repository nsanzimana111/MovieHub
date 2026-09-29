import express from 'express';
import { createCategory, createMovie, deleteCategory, deleteMovie, downloadMovie, getAdminMovies, getMovieById, getMovieCategories, listMovies, updateCategory, updateMovie } from '../controllers/movieController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { uploadMovieAssets } from '../config/upload.js';

const router = express.Router();

router.get('/categories', getMovieCategories);
router.get('/admin/all', authenticate, authorize('admin'), getAdminMovies);
router.get('/:id/download', authenticate, downloadMovie);
router.get('/:id', getMovieById);
router.get('/', listMovies);

router.post('/categories', authenticate, authorize('admin'), createCategory);
router.put('/categories/:id', authenticate, authorize('admin'), updateCategory);
router.delete('/categories/:id', authenticate, authorize('admin'), deleteCategory);

router.post(
  '/',
  authenticate,
  authorize('admin'),
  uploadMovieAssets,
  createMovie
);
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  uploadMovieAssets,
  updateMovie
);
router.delete('/:id', authenticate, authorize('admin'), deleteMovie);

export default router;
