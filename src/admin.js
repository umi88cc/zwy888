/**
* 优米博客 - 后台管理中心 (完整版)
* @功能 [基础设置 | 用户管理 | 文章管理(含回收站) | 评论管理]
*/

import { Hono } from 'hono';

const admin = new Hono();

// --- 中间件：管理员权限检查 ---
admin.use('*', async (c, next) => {
  const payload = c.get('jwtPayload');
  if (!payload) return c.json({ error: '未授权' }, 401);

  const user = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(payload.sub).first();
  if (!user || user.role !== 'admin') {
    return c.json({ error: '无权访问后台' }, 403);
  }
  await next();
});

// =======================
// 1. 基础设置 (KV存储)
// =======================

// 获取所有配置
admin.get('/settings', async (c) => {
  const settings = await c.env.KV.get('site_settings', { type: 'json' }) || {};
  return c.json({ success: true, data: settings });
});

// 保存配置 (网站名称、支付参数、插入配置)
admin.post('/settings/save', async (c) => {
  const body = await c.req.json();
  // 读取旧配置，合并新配置
  const oldSettings = await c.env.KV.get('site_settings', { type: 'json' }) || {};
  const newSettings = { ...oldSettings, ...body };
  
  await c.env.KV.put('site_settings', JSON.stringify(newSettings));
  return c.json({ success: true, message: '系统设置已保存' });
});

// =======================
// 2. 用户管理
// =======================

// 获取用户列表
admin.get('/users', async (c) => {
  const users = await c.env.DB.prepare('SELECT id, username, qq_number, role, vip_level, is_banned, created_at FROM users ORDER BY id DESC LIMIT 100').all();
  return c.json({ success: true, data: users.results });
});

// 新增用户 (手动添加)
admin.post('/users/add', async (c) => {
  const { username, password, role, vip_level } = await c.req.json();
  
  // 简单查重
  const exist = await c.env.DB.prepare('SELECT id FROM users WHERE username=?').bind(username).first();
  if(exist) return c.json({ success: false, message: '用户名已存在' }, 400);

  // 密码加密 (简单模拟SHA256，实际建议复用 auth.js 的函数)
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  await c.env.DB.prepare(
    'INSERT INTO users (username, password_hash, role, vip_level, qq_number) VALUES (?, ?, ?, ?, ?)'
  ).bind(username, passwordHash, role || 'user', vip_level || 0, '10000').run(); // 默认QQ 10000

  return c.json({ success: true, message: '用户已添加' });
});

// 编辑用户 (权限/等级/小黑屋)
admin.post('/users/edit', async (c) => {
  const { id, vip_level, role, is_banned } = await c.req.json();
  
  // 禁止封禁自己
  const currentAdminId = c.get('jwtPayload').sub;
  if (String(id) === String(currentAdminId) && is_banned === 1) {
    return c.json({ success: false, message: '不能封禁自己' }, 400);
  }

  await c.env.DB.prepare(
    'UPDATE users SET vip_level=?, role=?, is_banned=? WHERE id=?'
  ).bind(vip_level, role, is_banned, id).run();

  return c.json({ success: true, message: '用户信息已更新' });
});

// =======================
// 3. 文章管理
// =======================

// 获取文章列表 (支持状态筛选：published/trash)
admin.get('/posts', async (c) => {
  const status = c.req.query('status') || 'published';
  const posts = await c.env.DB.prepare('SELECT * FROM posts WHERE status = ? ORDER BY id DESC').bind(status).all();
  return c.json({ success: true, data: posts.results });
});

// 保存文章
admin.post('/posts/save', async (c) => {
  const { id, title, content, slug, price, view_permission, category_id } = await c.req.json();
  const now = Math.floor(Date.now() / 1000);
  
  if (id) {
    await c.env.DB.prepare(
      'UPDATE posts SET title=?, content=?, slug=?, price=?, view_permission=?, category_id=? WHERE id=?'
    ).bind(title, content, slug, price, view_permission, category_id, id).run();
  } else {
    await c.env.DB.prepare(
      'INSERT INTO posts (title, content, slug, price, view_permission, category_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(title, content, slug, price, view_permission, category_id, 'published', now).run();
  }
  return c.json({ success: true, message: '保存成功' });
});

// 移入回收站 / 彻底删除 / 还原
admin.post('/posts/status', async (c) => {
  const { id, action } = await c.req.json(); // action: 'trash', 'restore', 'delete'
  
  if (action === 'delete') {
    await c.env.DB.prepare('DELETE FROM posts WHERE id=?').bind(id).run();
    return c.json({ success: true, message: '已彻底删除' });
  } 
  
  const newStatus = action === 'trash' ? 'trash' : 'published';
  await c.env.DB.prepare('UPDATE posts SET status=? WHERE id=?').bind(newStatus, id).run();
  return c.json({ success: true, message: action === 'trash' ? '已移入回收站' : '已还原' });
});

// =======================
// 4. 评论管理 (需先建表)
// =======================
admin.get('/comments', async (c) => {
  // 简单的联表查询，获取用户名和文章标题
  const comments = await c.env.DB.prepare(`
    SELECT c.id, c.content, c.created_at, u.username, p.title 
    FROM comments c 
    LEFT JOIN users u ON c.user_id = u.id 
    LEFT JOIN posts p ON c.post_id = p.id 
    ORDER BY c.id DESC LIMIT 50
  `).all();
  return c.json({ success: true, data: comments.results });
});

admin.post('/comments/delete', async (c) => {
  const { id } = await c.req.json();
  await c.env.DB.prepare('DELETE FROM comments WHERE id=?').bind(id).run();
  return c.json({ success: true, message: '评论已删除' });
});

// =======================
// 5. 分类管理 (简单版)
// =======================
admin.get('/categories', async (c) => {
  const cats = await c.env.DB.prepare('SELECT * FROM categories ORDER BY id DESC').all();
  return c.json({ success: true, data: cats.results });
});

admin.post('/categories/save', async (c) => {
  const { name, slug, icon } = await c.req.json();
  await c.env.DB.prepare('INSERT INTO categories (name, slug, icon) VALUES (?, ?, ?)').bind(name, slug, icon).run();
  return c.json({ success: true, message: '分类已添加' });
});

admin.post('/categories/delete', async (c) => {
  const { id } = await c.req.json();
  await c.env.DB.prepare('DELETE FROM categories WHERE id=?').bind(id).run();
  return c.json({ success: true, message: '分类已删除' });
});

export default admin;
