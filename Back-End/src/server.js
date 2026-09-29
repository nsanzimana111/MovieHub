import app from './app.js';
import dotenv from 'dotenv';
import { pool } from './config/db.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 5000;

const start = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        const error = new Error('Production JWT configuration is invalid.');
        error.code = 'CONFIGURATION_ERROR';
        throw error;
      }
      const requiredVariables = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
      if (requiredVariables.some((name) => !process.env[name])) {
        const error = new Error('Required production environment configuration is missing.');
        error.code = 'CONFIGURATION_ERROR';
        throw error;
      }
    }

    const connection = await pool.getConnection();
    console.log('Connected to MySQL successfully.');
    connection.release();

    app.listen(PORT, () => {
      console.log(`MovieHub backend listening on port ${PORT}`);
    });
  } catch (error) {
    if (error.code === 'CONFIGURATION_ERROR') {
      console.error(error.message);
    } else {
      console.error(`MovieHub startup failed (${error.code || error.name || 'unknown error'}). Check the Render environment settings and database availability.`);
    }
    process.exit(1);
  }
};

start();
