import fs from 'fs';
import path from 'path';
import { pool } from '../config/db.js';
import { parseJsonError, toSlug } from '../utils/helpers.js';

const getPosterUrl = (file) => file ? `/uploads/posters/${path.basename(file.path)}` : null;

export const listMovies = async (req, res, next) => {
  try {
    const { search = '', category = '', sort = 'newest', page = 1, limit = 12 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const searchTerm = `%${search}%`;
    const categoryFilter = category ? ' AND m.category_id = ? ' : '';

    const [rows] = await pool.execute(
      `SELECT m.*, c.name AS category_name,
        (SELECT COUNT(*) FROM purchases p WHERE p.movie_id = m.id AND p.status = 'active') AS purchase_count
       FROM movies m
       LEFT JOIN categories c ON c.id = m.category_id
      WHERE m.status = 'published' AND (m.title LIKE ? OR m.description LIKE ?) ${categoryFilter}
       ORDER BY ${sort === 'price_low' ? 'm.price_rwf ASC' : sort === 'price_high' ? 'm.price_rwf DESC' : 'm.created_at DESC'}
       LIMIT ? OFFSET ?`,
      category ? [searchTerm, searchTerm, Number(category), Number(limit), offset] : [searchTerm, searchTerm, Number(limit), offset]
    );

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM movies m WHERE m.status = 'published' AND (m.title LIKE ? OR m.description LIKE ?) ${categoryFilter}`,
      category ? [searchTerm, searchTerm, Number(category)] : [searchTerm, searchTerm]
    );

    return res.json({
      success: true,
      movies: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(countRows[0].total),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMovieById = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT m.*, c.name AS category_name,
       (SELECT COUNT(*) FROM purchases p WHERE p.movie_id = m.id AND p.status = 'active') AS purchase_count
       FROM movies m
       LEFT JOIN categories c ON c.id = m.category_id
      WHERE m.id = ? AND m.status = 'published'`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Movie not found.' });
    }

    const movie = rows[0];
    return res.json({ success: true, movie });
  } catch (error) {
    next(error);
  }
};

export const createMovie = async (req, res, next) => {
  try {
    const { title, description, categoryId, genre, releaseYear, durationMinutes, language, country, priceRwf, status } = req.body;
    const posterPath = getPosterUrl(req.files?.poster?.[0]);
    const movieFile = req.files?.movieFile?.[0];

    if (!title || !movieFile || priceRwf === undefined || priceRwf === '' || !Number.isFinite(Number(priceRwf)) || Number(priceRwf) < 0) {
      return res.status(400).json({ success: false, message: 'Title, movie file, and a valid non-negative RWF price are required.' });
    }

    const slug = `${toSlug(title)}-${Date.now()}`;
    const [result] = await pool.execute(
      `INSERT INTO movies (
        category_id, uploaded_by, title, slug, description, genre, release_year, duration_minutes,
        language, country, poster_path, movie_file_path, movie_file_size, movie_file_mime_type, price_rwf, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        categoryId || null,
        req.user.id,
        title,
        slug,
        description || null,
        genre || null,
        releaseYear || null,
        durationMinutes || null,
        language || null,
        country || null,
        posterPath,
        movieFile.path.replace(/\\/g, '/'),
        movieFile.size,
        movieFile.mimetype,
        Number(priceRwf || 0),
        status || 'draft',
      ]
    );

    return res.status(201).json({ success: true, message: 'Movie uploaded successfully.', movieId: result.insertId });
  } catch (error) {
    next(error);
  }
};

export const updateMovie = async (req, res, next) => {
  try {
    const movieId = req.params.id;
    const [rows] = await pool.execute('SELECT * FROM movies WHERE id = ?', [movieId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Movie not found.' });
    }

    const existing = rows[0];
    const { title, description, categoryId, genre, releaseYear, durationMinutes, language, country, priceRwf, status } = req.body;
    const posterPath = getPosterUrl(req.files?.poster?.[0]) || existing.poster_path;
    const movieFile = req.files?.movieFile?.[0];
    const moviePath = movieFile ? movieFile.path.replace(/\\/g, '/') : existing.movie_file_path;
    const movieSize = movieFile ? movieFile.size : existing.movie_file_size;
    const movieMime = movieFile ? movieFile.mimetype : existing.movie_file_mime_type;
    if (priceRwf !== undefined && priceRwf !== '' && (!Number.isFinite(Number(priceRwf)) || Number(priceRwf) < 0)) {
      return res.status(400).json({ success: false, message: 'Movie price must be a valid non-negative RWF amount.' });
    }

    await pool.execute(
      `UPDATE movies SET
        category_id = ?, title = ?, description = ?, genre = ?, release_year = ?, duration_minutes = ?,
        language = ?, country = ?, poster_path = ?, movie_file_path = ?, movie_file_size = ?, movie_file_mime_type = ?,
        price_rwf = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        categoryId === '' ? existing.category_id : categoryId || null,
        title || existing.title,
        description || existing.description,
        genre || existing.genre,
        releaseYear || existing.release_year,
        durationMinutes || existing.duration_minutes,
        language || existing.language,
        country || existing.country,
        posterPath,
        moviePath,
        movieSize,
        movieMime,
        priceRwf === '' || priceRwf === undefined ? existing.price_rwf : Number(priceRwf),
        status || existing.status,
        movieId,
      ]
    );

    return res.json({ success: true, message: 'Movie updated successfully.' });
  } catch (error) {
    next(error);
  }
};

export const deleteMovie = async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM movies WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Movie not found.' });
    }

    await pool.execute('UPDATE movies SET status = ? WHERE id = ?', ['archived', req.params.id]);
    return res.json({ success: true, message: 'Movie archived successfully.' });
  } catch (error) {
    next(error);
  }
};

export const getAdminMovies = async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT m.*, c.name AS category_name, u.full_name AS uploaded_by_name
       FROM movies m
       LEFT JOIN categories c ON c.id = m.category_id
       LEFT JOIN users u ON u.id = m.uploaded_by
       ORDER BY m.created_at DESC`
    );

    return res.json({ success: true, movies: rows });
  } catch (error) {
    next(error);
  }
};

export const downloadMovie = async (req, res, next) => {
  try {
    const movieId = req.params.id;
    const [movieRows] = await pool.execute('SELECT * FROM movies WHERE id = ?', [movieId]);

    if (!movieRows.length) {
      return res.status(404).json({ success: false, message: 'Movie not found.' });
    }

    const movie = movieRows[0];
    const [purchaseRows] = await pool.execute(
      'SELECT * FROM purchases WHERE user_id = ? AND movie_id = ? AND status = ? LIMIT 1',
      [req.user.id, movieId, 'active']
    );

    if (!purchaseRows.length) {
      return res.status(403).json({ success: false, message: 'You do not have access to this movie.' });
    }

    const safePath = path.isAbsolute(movie.movie_file_path)
      ? path.resolve(movie.movie_file_path)
      : path.resolve(process.cwd(), movie.movie_file_path.replace(/^\//, ''));
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ success: false, message: 'Movie file not found.' });
    }

    await pool.execute(
      'INSERT INTO download_logs (user_id, movie_id, purchase_id, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, movieId, purchaseRows[0].id, req.ip, req.headers['user-agent'] || 'unknown']
    );

    res.download(safePath, path.basename(safePath));
  } catch (error) {
    next(error);
  }
};

export const getMovieCategories = async (_req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM categories ORDER BY name ASC');
    return res.json({ success: true, categories: rows });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const [result] = await pool.execute('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description || null]);
    return res.status(201).json({ success: true, categoryId: result.insertId });
  } catch (error) {
    next(new Error(parseJsonError(error)));
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    await pool.execute('UPDATE categories SET name = ?, description = ? WHERE id = ?', [name, description || null, req.params.id]);
    return res.json({ success: true, message: 'Category updated successfully.' });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    await pool.execute('DELETE FROM categories WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
