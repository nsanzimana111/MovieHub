import crypto from 'crypto';

export const toSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const makeOrderReference = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `MH-${stamp}-${random}`;
};

export const safeIp = (req) => req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

export const parseJsonError = (error) =>
  error && error.message ? error.message : 'Unexpected server error';
