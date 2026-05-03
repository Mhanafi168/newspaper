require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { initializeDatabase, query, queryOne } = require('./db');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'newspaper-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

// ─── Password Utilities (using bcrypt) ──────────────────────────────────────
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// ─── RBAC ────────────────────────────────────────────────────────────────────
const ROLES = {
  ADMIN:  { name: 'admin',  permissions: ['read', 'write', 'delete', 'manage_users', 'view_logs', 'publish', 'delete_post'] },
  EDITOR: { name: 'editor', permissions: ['read', 'write', 'delete', 'delete_post'] },
  VIEWER: { name: 'viewer', permissions: ['read'] },
};

// ─── In-Memory DB ─────────────────────────────────────────────────────────────
// ✓ Replaced with MySQL - see db.js for connection pool
// Database is initialized on server startup

// ─── Audit Logging ──────────────────────────────────────────────────────────────
async function logAudit(action, userId, details = {}) {
  try {
    const id = crypto.randomUUID();
    await query(
      'INSERT INTO auditLog (id, action, userId, details) VALUES (?, ?, ?, ?)',
      [id, action, userId, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

// ─── Database Seeding ────────────────────────────────────────────────────────────
async function seedDatabase() {
  try {
    const userCount = await queryOne('SELECT COUNT(*) as count FROM users');
    if (userCount.count === 0) {
      console.log('🌱 Seeding default users...');
      const defaultUsers = [
        { username: 'admin', email: 'admin@press.com', password: 'Admin@123', role: 'admin' },
        { username: 'editor', email: 'editor@press.com', password: 'Editor@123', role: 'editor' },
        { username: 'viewer', email: 'viewer@press.com', password: 'Viewer@123', role: 'viewer' },
      ];

      for (const user of defaultUsers) {
        const id = crypto.randomUUID();
        const passwordHash = await hashPassword(user.password);
        await query(
          'INSERT INTO users (id, username, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)',
          [id, user.username, user.email, passwordHash, user.role]
        );
      }
      console.log('✓ Default users created');

      // Seed sample articles
      const editor = await queryOne('SELECT id FROM users WHERE username = ?', ['editor']);
      if (editor) {
        const articles = [
          {
            id: crypto.randomUUID(),
            title: 'Welcome to The Daily Press',
            content: 'This is your secure newspaper platform. Editors can publish articles, viewers can read them, and admins keep everything running smoothly.',
            authorId: editor.id,
            authorName: 'editor',
            status: 'published',
          },
          {
            id: crypto.randomUUID(),
            title: 'Understanding Role-Based Access Control',
            content: 'RBAC is a method of restricting system access to authorized users. Admin users can manage users and view audit logs. Editor users can write and publish articles. Viewer users can only read published content.',
            authorId: editor.id,
            authorName: 'editor',
            status: 'published',
          },
        ];

        for (const article of articles) {
          await query(
            'INSERT INTO articles (id, title, content, authorId, authorName, status) VALUES (?, ?, ?, ?, ?, ?)',
            [article.id, article.title, article.content, article.authorId, article.authorName, article.status]
          );
        }
        console.log('✓ Sample articles created');
      }
    }
  } catch (error) {
    console.error('Seeding error:', error);
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function authorize(...perms) {
  return (req, res, next) => {
    const role = ROLES[req.user.role.toUpperCase()];
    if (!role) return res.status(403).json({ error: 'Unknown role' });
    const ok = perms.every(p => role.permissions.includes(p));
    if (!ok) {
      // Non-blocking audit log
      logAudit('PERMISSION_DENIED', req.user.id, { required: perms, role: req.user.role }).catch(console.error);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, role = 'viewer' } = req.body;
    
    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!ROLES[role?.toUpperCase()]) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user exists
    const existing = await queryOne(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password and create user
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    
    await query(
      'INSERT INTO users (id, username, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)',
      [id, username, email, passwordHash, role]
    );

    await logAudit('USER_REGISTERED', id, { username, role });
    res.status(201).json({ message: 'Registered successfully' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find user
    const user = await queryOne('SELECT * FROM users WHERE username = ?', [username]);
    
    if (!user) {
      await logAudit('LOGIN_FAILED', username, { reason: 'User not found' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      await logAudit('LOGIN_FAILED', user.id, { reason: 'Invalid password' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    await logAudit('LOGIN_SUCCESS', user.id, { username });
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: ROLES[user.role.toUpperCase()].permissions,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: ROLES[user.role.toUpperCase()].permissions,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ─── ARTICLE ROUTES ───────────────────────────────────────────────────────────

// GET all articles — viewers see published only, editors/admins see all
app.get('/api/articles', authenticate, authorize('read'), (req, res) => {
  const role = req.user.role;
  const visible = (role === 'viewer')
    ? articles.filter(a => a.status === 'published')
    : articles;
  res.json([...visible].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// GET single article
app.get('/api/articles/:id', authenticate, authorize('read'), (req, res) => {
  const article = articles.find(a => a.id === req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  if (article.status === 'draft' && req.user.role === 'viewer')
    return res.status(403).json({ error: 'Access denied' });
  res.json(article);
});

// POST create article (editor/admin)
app.post('/api/articles', authenticate, authorize('write'), (req, res) => {
  const { title, content } = req.body;
  if (!title?.trim() || !content?.trim()) return res.status(400).json({ error: 'Title and content are required' });

  const article = {
    id: crypto.randomUUID(),
    title: title.trim(),
    content: content.trim(),
    authorId: req.user.id,
    authorName: req.user.username,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  articles.push(article);
  logAudit('ARTICLE_CREATED', req.user.id, { articleId: article.id, title });
  res.status(201).json(article);
});

// PATCH update article (editor/admin — only own articles for editor)
app.patch('/api/articles/:id', authenticate, authorize('write'), (req, res) => {
  const article = articles.find(a => a.id === req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  if (req.user.role === 'editor' && article.authorId !== req.user.id)
    return res.status(403).json({ error: 'You can only edit your own articles' });

  const { title, content } = req.body;
  if (title) article.title = title.trim();
  if (content) article.content = content.trim();
  article.updatedAt = new Date().toISOString();
  logAudit('ARTICLE_UPDATED', req.user.id, { articleId: article.id });
  res.json(article);
});

// PATCH publish/unpublish (editor/admin)
app.patch('/api/articles/:id/status', authenticate, authorize('publish'), (req, res) => {
  const article = articles.find(a => a.id === req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  if (req.user.role === 'editor' && article.authorId !== req.user.id)
    return res.status(403).json({ error: 'You can only publish your own articles' });

  article.status = article.status === 'published' ? 'draft' : 'published';
  article.updatedAt = new Date().toISOString();
  logAudit('ARTICLE_STATUS_CHANGED', req.user.id, { articleId: article.id, status: article.status });
  res.json(article);
});

// DELETE article (editors can delete own articles, admins can delete any)
app.delete('/api/articles/:id', authenticate, authorize('delete_post'), (req, res) => {
  const idx = articles.findIndex(a => a.id === req.params.id);
  const article = articles.find(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Article not found' });
  if (req.user.role === 'editor' && article.authorId !== req.user.id)
    return res.status(403).json({ error: 'You can only delete your own articles' });
  const [removed] = articles.splice(idx, 1);
  logAudit('ARTICLE_DELETED', req.user.id, { articleId: removed.id, title: removed.title });
  res.json({ message: 'Article deleted' });
});

// ─── USER MANAGEMENT (admin) ──────────────────────────────────────────────────
app.get('/api/users', authenticate, authorize('manage_users'), (req, res) => {
  res.json(users.map(({ salt, passwordHash, ...u }) => ({ ...u, permissions: ROLES[u.role.toUpperCase()].permissions })));
});

app.patch('/api/users/:id/role', authenticate, authorize('manage_users'), (req, res) => {
  const { role } = req.body;
  if (!ROLES[role?.toUpperCase()]) return res.status(400).json({ error: 'Invalid role' });
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const old = user.role;
  user.role = role;
  logAudit('ROLE_CHANGED', req.user.id, { targetUserId: user.id, oldRole: old, newRole: role });
  res.json({ message: 'Role updated' });
});

app.patch('/api/users/:id/status', authenticate, authorize('manage_users'), (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'Cannot deactivate yourself' });
  user.isActive = !user.isActive;
  logAudit('USER_STATUS_CHANGED', req.user.id, { targetUserId: user.id, isActive: user.isActive });
  res.json({ isActive: user.isActive });
});

app.get('/api/logs', authenticate, authorize('view_logs'), (req, res) => {
  res.json([...auditLog].reverse().slice(0, 100));
});

app.get('/api/roles', authenticate, (req, res) => {
  res.json(Object.values(ROLES));
});

const PORT = process.env.PORT || 4000;

// ─── Server Startup ─────────────────────────────────────────────────────────────
async function startServer() {
  try {
    console.log('🗄️  Initializing MySQL database...');
    await initializeDatabase();
    console.log('✓ Database initialized');

    console.log('🌱 Seeding database with sample data...');
    await seedDatabase();
    console.log('✓ Database ready');

    app.listen(PORT, () => {
      console.log(`📰 Newspaper server running on http://localhost:${PORT}`);
      console.log('💾 Data persistence: MySQL enabled');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
