require('dotenv').config();
const mysql = require('mysql2/promise');

// MySQL connection pool configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'newspaper_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Initialize database and create tables
async function initializeDatabase() {
  let connection;
  try {
    // Create database if it doesn't exist
    const rootConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    const dbName = process.env.DB_NAME || 'newspaper_db';
    await rootConnection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    console.log(`✓ Database '${dbName}' created or already exists`);
    await rootConnection.end();

    // Get connection from pool
    connection = await pool.getConnection();

    // Create users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        passwordHash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'viewer',
        isActive BOOLEAN DEFAULT true,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (username),
        INDEX (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Users table created or already exists');

    // Create articles table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        content LONGTEXT NOT NULL,
        authorId VARCHAR(36) NOT NULL,
        authorName VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX (status),
        INDEX (authorId),
        FULLTEXT INDEX (title, content)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Articles table created or already exists');

    // Create audit log table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS auditLog (
        id VARCHAR(36) PRIMARY KEY,
        action VARCHAR(255) NOT NULL,
        userId VARCHAR(36),
        details JSON,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
        INDEX (action),
        INDEX (userId),
        INDEX (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Audit log table created or already exists');

    return true;
  } catch (error) {
    console.error('Database initialization error:', error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

// Helper function to execute queries
async function query(sql, values) {
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(sql, values);
    return results;
  } finally {
    if (connection) connection.release();
  }
}

// Helper function to get a single row
async function queryOne(sql, values) {
  const results = await query(sql, values);
  return results.length > 0 ? results[0] : null;
}

// Export functions
module.exports = {
  pool,
  initializeDatabase,
  query,
  queryOne,
};
