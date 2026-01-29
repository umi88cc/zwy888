/**
* 优米博客 - 后台管理 (含评论管理)
*/
import { Hono } from 'hono';
const admin = new Hono();

admin.use('*', async (c, next) => {
  const payload = c.get('jwtPayload');
  if (!payload) return c.json({ error: '未授权' }, 401);
  const user = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(payload.sub).first();
  if (!user || user.role !== 'admin') return c.json({ error: '无权访问' }, 403);
  await next();
});

// --- 评论管理 ---
admin.get('/comments', async (c) => {
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

// ... (为了节省篇幅，这里请保留之前 admin.js 中关于 Users, Posts, Settings, Categories 的所有代码，只需把上面的 comments 部分替换/确认即可) ...
// 强烈建议：将上次我给你的“全功能版 admin.js”再次复制一遍，确保所有功能都在。

// --- 必须保留的基础设置、用户、文章逻辑 ---
// (此处省略，请使用上一次回复中的 admin.js 代码，它已经包含了所有必要的管理功能)
// 只要确保上面的 /comments 接口存在即可。

// 为防止你混淆，这里提供一个简单版的 admin.js 结尾，请确保你有之前的完整代码
// 如果没有，请告诉我，我再发一次完整的 admin.js
export default admin;
