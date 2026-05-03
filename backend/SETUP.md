# MySQL Database Setup Guide

## Overview

Your application has been updated to use MySQL for persistent data storage instead of in-memory variables. This means your user login data and articles will **persist even after the server restarts**. 

## What Changed

✅ **User login credentials** now stored in MySQL with bcrypt hashing  
✅ **Articles** persist in the database  
✅ **Audit logs** track all user actions  
✅ **Password security** upgraded to bcrypt (industry standard)  
✅ **Environment variables** for secure credential management  

## Prerequisites

- **Node.js** (v14 or higher)
- **MySQL** (v5.7 or higher)
- A terminal/command prompt

## Installation Steps

### 1. Install MySQL

**Windows:**
- Download from: https://dev.mysql.com/downloads/mysql/
- Run the installer and follow the wizard
- Note the port (default: 3306)

**macOS (Homebrew):**
```bash
brew install mysql
brew services start mysql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install mysql-server
sudo systemctl start mysql
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

This will install:
- `mysql2` - MySQL driver with Promise support
- `bcrypt` - Password hashing library
- `dotenv` - Environment variable loader
- Other existing dependencies

### 3. Configure Environment Variables

Copy the `.env` file (it's already created with defaults):

```bash
# The .env file should contain:
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=newspaper_db
PORT=4000
JWT_SECRET=newspaper-secret-key-change-in-production
JWT_EXPIRES_IN=2h
```

**To use a custom MySQL user** (recommended for production):

1. Open MySQL:
```bash
mysql -u root -p
```

2. Create a user:
```sql
CREATE USER 'newspaper'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON newspaper_db.* TO 'newspaper'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

3. Update `.env`:
```
DB_USER=newspaper
DB_PASSWORD=your_secure_password
```

### 4. Start the Server

```bash
npm run dev
```

**What happens on first run:**
- ✓ Creates the `newspaper_db` database
- ✓ Creates three tables: `users`, `articles`, `auditLog`
- ✓ Inserts default sample users
- ✓ Inserts sample articles

**Sample login credentials:**
```
Username: admin    Password: Admin@123    Role: admin
Username: editor   Password: Editor@123   Role: editor
Username: viewer   Password: Viewer@123   Role: viewer
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,  -- bcrypt hashed password
  role VARCHAR(50) DEFAULT 'viewer',
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Articles Table
```sql
CREATE TABLE articles (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  content LONGTEXT NOT NULL,
  authorId VARCHAR(36) NOT NULL,
  authorName VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (authorId) REFERENCES users(id)
);
```

### Audit Log Table
```sql
CREATE TABLE auditLog (
  id VARCHAR(36) PRIMARY KEY,
  action VARCHAR(255) NOT NULL,
  userId VARCHAR(36),
  details JSON,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## File Structure

```
backend/
├── db.js                 # MySQL connection pool & initialization
├── server.js             # Main Express application
├── .env                  # Environment variables (gitignored)
├── .env.example          # Template for environment variables
├── init-db.sql           # Manual database setup script (if needed)
├── package.json          # Dependencies with mysql2, bcrypt, dotenv
└── SETUP.md              # This file
```

## Key Files Explained

### db.js
- Sets up MySQL connection pool
- Creates tables automatically on startup
- Provides `query()` and `queryOne()` helper functions
- Handles database initialization

### server.js
- Routes for login/register using MySQL queries
- Password hashing with bcrypt
- JWT token generation for authenticated sessions
- All data operations use database instead of memory

### .env
- Database credentials
- Server configuration
- JWT settings

## Troubleshooting

### "Can't connect to MySQL server"

**Check if MySQL is running:**

Windows:
```bash
tasklist | findstr "mysqld"
```

macOS/Linux:
```bash
pgrep -l mysql
```

**Start MySQL:**

Windows (Services):
1. Press `Win + R`
2. Type `services.msc`
3. Find "MySQL" and click Start

macOS:
```bash
brew services start mysql
```

Linux:
```bash
sudo systemctl start mysql
```

### "Access denied for user 'root'@'localhost'"

Your root password might not be empty. Update `.env`:
```
DB_PASSWORD=your_password
```

Or create a new MySQL user:
```sql
CREATE USER 'newspaper'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON newspaper_db.* TO 'newspaper'@'localhost';
FLUSH PRIVILEGES;
```

### "Tables don't exist"

The app creates tables automatically. If you see errors:

1. Stop the server (Ctrl+C)
2. Make sure MySQL is running
3. Delete the `newspaper_db` database:
   ```sql
   DROP DATABASE newspaper_db;
   ```
4. Restart the server

### Port 3306 already in use

MySQL is already running or another process is using the port. Check:
```bash
# Windows
netstat -ano | findstr :3306

# macOS/Linux  
lsof -i :3306
```

### "Cannot find module 'mysql2'"

Run:
```bash
npm install
```

## Security Best Practices

✅ **Passwords are hashed with bcrypt** (10 salt rounds)  
✅ **Credentials stored in .env** (never commit to git)  
✅ **JWT tokens for session management**  
✅ **SQL injection prevention** (parameterized queries)  
✅ **Use HTTPS in production**  

### Production Setup

1. Change JWT_SECRET:
   ```env
   JWT_SECRET=your-very-long-random-secure-key-here
   ```

2. Use a strong database password

3. Create a dedicated database user with limited privileges

4. Use environment-specific `.env` files

5. Enable SSL/TLS for MySQL connections

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info

### Articles
- `GET /api/articles` - List articles
- `GET /api/articles/:id` - Get single article
- `POST /api/articles` - Create new article
- `PATCH /api/articles/:id` - Update article
- `PATCH /api/articles/:id/status` - Publish/unpublish
- `DELETE /api/articles/:id` - Delete article

### Admin
- `GET /api/users` - List all users
- `PATCH /api/users/:id/role` - Change user role
- `PATCH /api/users/:id/status` - Activate/deactivate user
- `GET /api/logs` - View audit logs

## Next Steps

1. ✅ Install MySQL
2. ✅ Update `.env` with your database credentials
3. ✅ Run `npm install`
4. ✅ Start server with `npm run dev`
5. ✅ Test login with provided sample credentials

## Support

If you encounter issues:
1. Check the error message in the console
2. Verify MySQL is running
3. Review the Troubleshooting section
4. Check `.env` file is correct
5. Ensure all dependencies are installed (`npm install`)
