/**
* 模块: 业务 API (文章数据、上传)
*/
import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { parseShortcodes } from './utils';

const app = new Hono();

// 1. 文章列表 API
app.get('/posts/list', async (c) => {
  try {
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '10');
      const offset = (page - 1) * limit;
      
      const { results } = await c.env.DB.prepare(`SELECT id, title, slug, thumbnail_url, content, price, view_permission, created_at FROM posts WHERE status = 'published' ORDER BY id DESC LIMIT ? OFFSET ?`).bind(limit, offset).all();
      const totalRes = await c.env.DB.prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'published'").first();
      
      const posts = (results || []).map(p => {
          // 提取纯文本摘要
          const plainText = p.content ? p.content.replace(/<[^>]+>/g, '').substring(0, 100) + '...' : '';
          return { ...p, excerpt: plainText, content: undefined };
      });
      
      return c.json({ 
          success: true, 
          data: posts, 
          total: totalRes ? totalRes.count : 0, 
          page: page, 
          totalPages: Math.ceil((totalRes ? totalRes.count : 0) / limit) 
      });
  } catch (e) {
      return c.json({ success: false, message: e.message, data: [] });
  }
});

// 2. 解锁文章内容 (需要 JWT 权限)
app.get('/posts/content/:id', async (c, next) => {
    // 手动调用 JWT 中间件逻辑，或者在 worker.js 统一绑定
    // 这里假设 worker.js 已经对 /api/posts/content/* 进行了保护，直接获取 payload
    const user = c.get('jwtPayload');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const id = c.req.param('id');
    try {
        const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(id).first();
        if (!post) return c.json({error: '文章不存在'}, 404);
        
        let hasBought = false;
        if (post.price > 0) {
            const order = await c.env.DB.prepare('SELECT id FROM orders WHERE user_id=? AND related_id=? AND status="paid"').bind(user.sub, id).first();
            if (order) hasBought = true;
        }
        
        const content = await parseShortcodes(c, post.content, user.vip_level, hasBought, user.sub, id);
        return c.json({ success: true, content });
    } catch(e) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

// 3. 图片上传 API
app.post('/upload', async (c) => {
  const body = await c.req.parseBody(); 
  const file = body['file']; 
  if (!file) return c.json({ error: 'No file selected' }, 400);
  
  const fileName = `images/${Date.now()}_${file.name}`; 
  await c.env.IMG_BUCKET.put(fileName, file); 
  
  return c.json({ success: true, url: `/images/${fileName}` });
});

export default app;
