import pg from 'pg';
import { config } from './config.js';

// The pool connects lazily, so importing this file never fails by itself.
export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export const query = (text, params) => pool.query(text, params);
export const close = () => pool.end();
