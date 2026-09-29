import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads'));
const movieDir = path.join(uploadRoot, 'movies');
const posterDir = path.join(uploadRoot, 'posters');

ensureDir(movieDir);
ensureDir(posterDir);

const storage = (targetDir) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, targetDir),
    filename: (_req, file, cb) => {
      const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      cb(null, safeName);
    },
  });

const fileFilter = (allowedMimeTypes, allowedExtensions) => (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeOk = allowedMimeTypes.includes(file.mimetype);
  const extOk = allowedExtensions.includes(extension);

  if (mimeOk && extOk) {
    cb(null, true);
    return;
  }

  cb(new Error('Invalid file type. Please upload a supported file format.'));
};

export const uploadPoster = multer({
  storage: storage(posterDir),
  limits: { fileSize: Number(process.env.MAX_POSTER_FILE_SIZE_MB || 5) * 1024 * 1024 },
  fileFilter: fileFilter(['image/jpeg', 'image/png', 'image/webp'], ['.jpg', '.jpeg', '.png', '.webp']),
});

export { posterDir };

export const uploadMovie = multer({
  storage: storage(movieDir),
  limits: { fileSize: Number(process.env.MAX_MOVIE_FILE_SIZE_MB || 2048) * 1024 * 1024 },
  fileFilter: fileFilter(['video/mp4', 'video/webm', 'video/quicktime'], ['.mp4', '.webm', '.mov']),
});

const posterTypes = ['image/jpeg', 'image/png', 'image/webp'];
const posterExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
const movieTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
const movieExtensions = ['.mp4', '.webm', '.mov'];
const posterSizeLimit = Number(process.env.MAX_POSTER_FILE_SIZE_MB || 5) * 1024 * 1024;

const assetStorage = multer.diskStorage({
  destination: (_req, file, cb) => cb(null, file.fieldname === 'poster' ? posterDir : movieDir),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    cb(null, safeName);
  },
});

const assetFileFilter = (_req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const allowed = file.fieldname === 'poster'
    ? posterTypes.includes(file.mimetype) && posterExtensions.includes(extension)
    : file.fieldname === 'movieFile'
      && movieTypes.includes(file.mimetype)
      && movieExtensions.includes(extension);

  if (!allowed) {
    cb(new Error('Invalid file type for the selected upload field.'));
    return;
  }

  cb(null, true);
};

const parseMovieAssets = multer({
  storage: assetStorage,
  limits: { fileSize: Number(process.env.MAX_MOVIE_FILE_SIZE_MB || 2048) * 1024 * 1024 },
  fileFilter: assetFileFilter,
}).fields([
  { name: 'poster', maxCount: 1 },
  { name: 'movieFile', maxCount: 1 },
]);

export const uploadMovieAssets = (req, res, next) => {
  parseMovieAssets(req, res, async (error) => {
    if (error) return next(error);

    const poster = req.files?.poster?.[0];
    if (poster && poster.size > posterSizeLimit) {
      try {
        await fs.promises.unlink(poster.path);
      } catch {
        // Preserve the original upload error if temporary-file cleanup fails.
      }
      return next(new multer.MulterError('LIMIT_FILE_SIZE', 'poster'));
    }

    next();
  });
};
