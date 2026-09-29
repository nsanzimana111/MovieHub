import app from './app.js';
import dotenv from 'dotenv';
import { pool } from './config/db.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 5000;

const start = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error('Production requires JWT_SECRET to contain at least 32 characters.');
      }
      if (!process.env.FRONTEND_URL || !process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
        throw new Error('Production requires FRONTEND_URL, DB_HOST, DB_USER, and DB_NAME environment variables.');
      }
    }

    const connection = await pool.getConnection();
    console.log('Connected to MySQL successfully.');
    connection.release();

    app.listen(PORT, () => {
      console.log(`MovieHub backend listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to MySQL. Check your XAMPP/MySQL settings in .env');
    console.error(error.message);
    process.exit(1);
  }
};

start();
