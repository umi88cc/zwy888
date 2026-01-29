import { Hono } from 'hono';
const admin = new Hono();

admin.use('*', async (c, next) => {
  const payload = c.get('jwtPayload'); if (!payload) return c.json({ error: '未授权' }, 401);
  const user = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(payload.sub).first();
  if (!user || user.role !== 'admin') return c.json({ error: '无权' }, 403);
  await next();
});

// Settings
admin.get('/settings', async (c) => { const s = await c.env.KV.get('site_settings', { type: 'json' }) || {}; return c.json({ success: true, data: s }); });
admin.post('/settings/save', async (c) => { const b = await c.req.json(); const o = await c.env.KV.get('site_settings', { type: 'json' }) || {}; await c.env.KV.put('site_settings', JSON.stringify({ ...o, ...b })); return c.json({ success: true }); });

// Users
admin.get('/users', async (c) => { const u = await c.env.DB.prepare('SELECT id, username, qq_number, role, vip_level, is_banned FROM users ORDER BY id DESC LIMIT 50').all(); return c.json({ success: true, data: u.results }); });
admin.post('/users/add', async (c) => { const { username, password } = await c.req.json(); const msgBuffer = new TextEncoder().encode(password); const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer); const hashArray = Array.from(new Uint8Array(hashBuffer)); const ph = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); await c.env.DB.prepare('INSERT INTO users (username, password_hash, role, vip_level, qq_number) VALUES (?, ?, ?, ?, ?)').bind(username, ph, 'user', 0, '10000').run(); return c.json({ success: true }); });

// Posts
admin.get('/posts', async (c) => { const p = await c.env.DB.prepare('SELECT * FROM posts ORDER BY id DESC').all(); return c.json({ success: true, data: p.results }); });
admin.post('/posts/save', async (c) => { const { id, title, content, slug, price, view_permission } = await c.req.json(); const now = Math.floor(Date.now() / 1000); if (id) { await c.env.DB.prepare('UPDATE posts SET title=?, content=?, slug=?, price=?, view_permission=? WHERE id=?').bind(title, content, slug, price, view_permission, id).run(); } else { await c.env.DB.prepare('INSERT INTO posts (title, content, slug, price, view_permission, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(title, content, slug, price, view_permission, 'published', now).run(); } return c.json({ success: true }); });

// Comments
admin.get('/comments', async (c) => { const cm = await c.env.DB.prepare(`SELECT c.id, c.content, u.username, p.title FROM comments c LEFT JOIN users u ON c.user_id = u.id LEFT JOIN posts p ON c.post_id = p.id ORDER BY c.id DESC LIMIT 50`).all(); return c.json({ success: true, data: cm.results }); });
admin.post('/comments/delete', async (c) => { const { id } = await c.req.json(); await c.env.DB.prepare('DELETE FROM comments WHERE id=?').bind(id).run(); return c.json({ success: true }); });

export default admin;
