-- SQL Script to initialize Newspaper Database
-- Run this script in MySQL if automatic initialization doesn't work

-- Create database
CREATE DATABASE IF NOT EXISTS newspaper_db;
USE newspaper_db;

-- Create users table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create articles table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create audit log table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Example: Insert sample users (passwords should be bcrypt hashed in production)
-- These are just for reference - the app will hash passwords automatically
INSERT INTO users (id, username, email, passwordHash, role, isActive) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'admin', 'admin@press.com', 'will-be-hashed-by-app', 'admin', true),
  ('550e8400-e29b-41d4-a716-446655440002', 'editor', 'editor@press.com', 'will-be-hashed-by-app', 'editor', true),
  ('550e8400-e29b-41d4-a716-446655440003', 'viewer', 'viewer@press.com', 'will-be-hashed-by-app', 'viewer', true)
ON DUPLICATE KEY UPDATE username=VALUES(username);
