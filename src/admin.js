/**
* 优米博客 - 专注网络优质资源分享！
* @永久网址 [WWW.UMI88.CC]
* @联系扣扣 [主446099815][副228522198]
* @ 加群交流[唯一官方QQ群:13936509]
* @todo [后台管理模块 - 仅限管理员访问]
*/

import { Hono } from 'hono';

const admin = new Hono();

// --- 中间件：强制管理员权限检查 ---
// 所有 /api/admin/* 的请求都会先经过这里
admin.use('*', async (c, next) => {
  const payload = c.get('jwtPayload'); // 从 worker.js 的 JWT 中间件获取
  if (!payload) return c.json({ error: '未授权' }, 401);

  // 二次查库，确保用户没被降级
  const user = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(payload.sub).first();
  
  if (!user || user.role !== 'admin') {
    return c.json({ error: '无权访问后台' }, 403);
  }
  
  await next();
});

// --- 1. 用户管理接口 ---

// 获取用户列表
admin.get('/users', async (c) => {
  const users = await c.env.DB.prepare('SELECT id, username, qq_number, role, vip_level, is_banned, created_at FROM users ORDER BY id DESC LIMIT 50').all();
  return c.json({ success: true, data: users.results });
});

// 封禁/解封用户 (小黑屋)
admin.post('/users/ban', async (c) => {
  const { userId, isBanned } = await c.req.json();
  // 禁止封禁自己
  const currentAdminId = c.get('jwtPayload').sub;
  if (String(userId) === String(currentAdminId)) {
    return c.json({ success: false, message: '不能封禁自己' }, 400);
  }

  await c.env.DB.prepare('UPDATE users SET is_banned = ? WHERE id = ?')
    .bind(isBanned ? 1 : 0, userId).run();
    
  return c.json({ success: true, message: isBanned ? '已关进小黑屋' : '已释放' });
});

// 修改用户会员等级
admin.post('/users/vip', async (c) => {
  const { userId, vipLevel } = await c.req.json();
  await c.env.DB.prepare('UPDATE users SET vip_level = ? WHERE id = ?')
    .bind(vipLevel, userId).run();
  return c.json({ success: true, message: '权限已更新' });
});


// --- 2. 文章管理接口 ---

// 获取文章列表
admin.get('/posts', async (c) => {
  const posts = await c.env.DB.prepare('SELECT id, title, category_id, price, view_permission, created_at FROM posts ORDER BY id DESC').all();
  return c.json({ success: true, data: posts.results });
});

// 发布/编辑文章
admin.post('/posts/save', async (c) => {
  const { id, title, content, slug, price, view_permission } = await c.req.json();
  
  if (id) {
    // 更新现有文章
    await c.env.DB.prepare(
      'UPDATE posts SET title=?, content=?, slug=?, price=?, view_permission=? WHERE id=?'
    ).bind(title, content, slug, price, view_permission, id).run();
    return c.json({ success: true, message: '文章已更新' });
  } else {
    // 新增文章
    await c.env.DB.prepare(
      'INSERT INTO posts (title, content, slug, price, view_permission) VALUES (?, ?, ?, ?, ?)'
    ).bind(title, content, slug, price, view_permission).run();
    return c.json({ success: true, message: '文章已发布' });
  }
});

// 删除文章
admin.post('/posts/delete', async (c) => {
  const { id } = await c.req.json();
  await c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: '文章已删除' });
});

// --- 3. 基础设置接口 ---
admin.post('/settings/menu', async (c) => {
  const { menuJson } = await c.req.json();
  await c.env.KV.put('site_menu', menuJson);
  return c.json({ success: true, message: '菜单配置已保存' });
});

export default admin;
