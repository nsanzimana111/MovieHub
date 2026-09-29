export const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
};

export const errorHandler = (error, _req, res, _next) => {
  console.error(error);
  const uploadError = error.name === 'MulterError';
  const status = error.statusCode || error.status || (uploadError ? error.code === 'LIMIT_FILE_SIZE' ? 413 : 400 : 500);
  const message = process.env.NODE_ENV === 'production' && status >= 500
    ? 'Something went wrong on the server.'
    : error.message || 'Something went wrong on the server.';
  res.status(status).json({
    success: false,
    message,
  });
};
