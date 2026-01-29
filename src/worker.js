/**
* 优米博客 - 核心 Worker (修复版)
*/
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import auth from './auth';
import pay from './pay';
import admin from './admin';
import comments from './comments';

const app = new Hono();

// 1. 全局配置
app.use('/*', cors());

// 2. 挂载路由
app.route('/api/auth', auth);
app.route('/api/pay', pay);
app.route('/api/admin', admin);
app.route('/api/comments', comments);

// 3. JWT
const jwtConfig = { secret: (c) => c.env.JWT_SECRET, alg: 'HS256' };
app.use('/api/user/*', jwt(jwtConfig));
app.use('/api/pay/create', jwt(jwtConfig));
app.use('/api/admin/*', jwt(jwtConfig));
app.use('/api/comments/add', jwt(jwtConfig));
app.use('/api/comments/like', jwt(jwtConfig));

// 4. 一键安装路由 (保留)
app.get('/install_umi88_db', async (c) => {
    // ... (代码太长省略，保持你原来的一键安装代码即可，或者不用管它，重点是下面的 API) ...
    return c.text('请手动执行 SQL 建表'); 
});

// --- 核心修复：文章列表接口 ---
app.get('/api/posts/list', async (c) => {
  try {
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '10');
      const offset = (page - 1) * limit;

      // 查文章
      const { results } = await c.env.DB.prepare(
        `SELECT id, title, slug, thumbnail_url, content, price, view_permission, created_at 
         FROM posts 
         WHERE status = 'published' 
         ORDER BY id DESC LIMIT ? OFFSET ?`
      ).bind(limit, offset).all();

      // 查总数
      const totalRes = await c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM posts WHERE status = 'published'"
      ).first();
      
      const total = totalRes ? totalRes.count : 0;

      // 处理摘要
      const posts = (results || []).map(p => {
        const plainText = p.content ? p.content.replace(/<[^>]+>/g, '').substring(0, 100) + '...' : '';
        return { ...p, excerpt: plainText, content: undefined };
      });

      return c.json({
        success: true,
        data: posts,
        total: total,
        page: page,
        totalPages: Math.ceil(total / limit)
      });

  } catch (e) {
      // 如果出错，返回空数组而不是 500，防止前端卡死
      return c.json({ success: false, msg: e.message, data: [] });
  }
});

// --- 页面渲染 ---
async function renderPage(c, templateName, data = {}) {
    try {
        const headerRes = await c.env.ASSETS.fetch(new URL('/header.html', c.req.url));
        const footerRes = await c.env.ASSETS.fetch(new URL('/footer.html', c.req.url));
        const bodyRes = await c.env.ASSETS.fetch(new URL(`/${templateName}`, c.req.url));
        
        if (headerRes.status!==200 || bodyRes.status!==200) return c.html('<h1>模板加载失败</h1>');

        let header = await headerRes.text();
        let footer = await footerRes.text();
        let body = await bodyRes.text();

        header = header.replace('{{page_title}}', data.title || '首页');
        for (const [key, value] of Object.entries(data)) {
            body = body.replaceAll(`{{${key}}}`, value !== undefined ? value : '');
        }
        return c.html(header + body + footer);
    } catch(e) { return c.text('Error: '+e.message); }
}

// --- 路由 ---
app.get('/', async (c) => { return renderPage(c, 'index.html', { title: '首页' }); });

// 文章详情
app.get('/:category/:id.html', async (c) => {
  const id = c.req.param('id');
  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
  if (!post) return c.notFound();
  
  // 简单短代码处理
  let content = post.content || '';
  content = content.replace(/\[vip\]([\s\S]*?)\[\/vip\]/g, '<div class="vip-box locked">VIP内容</div>');
  content = content.replace(/\[pay\]([\s\S]*?)\[\/pay\]/g, '<div class="pay-box locked">付费内容</div>');

  return renderPage(c, 'post.html', {
      title: post.title,
      date: new Date(post.created_at * 1000).toISOString().slice(0,10),
      price: post.price || 0,
      content: content,
      id: post.id,
      like_count: post.like_count || 0
  });
});

// 静态资源
app.get('/*', async (c) => { return c.env.ASSETS.fetch(c.req.raw); });

export default app;
