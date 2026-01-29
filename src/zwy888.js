/**
* 优米博客 - 核心 Worker (模块组装 + 短代码 + API)
*/
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import auth from './auth';
import pay from './pay';
import admin from './admin';
import comments from './comments';

const app = new Hono();
app.use('/*', cors());

// 子路由
app.route('/api/auth', auth);
app.route('/api/pay', pay);
app.route('/api/admin', admin);
app.route('/api/comments', comments);

// JWT 保护
const jwtConfig = { secret: (c) => c.env.JWT_SECRET, alg: 'HS256' };
app.use('/api/user/*', jwt(jwtConfig));
app.use('/api/pay/create', jwt(jwtConfig));
app.use('/api/admin/*', jwt(jwtConfig));
// 评论状态查询可能带Token，这里不做强制拦截，由子路由处理
app.use('/api/comments/add', jwt(jwtConfig));
app.use('/api/comments/like', jwt(jwtConfig));

// --- 页面组装函数 ---
async function renderPage(c, templateName, data = {}) {
    const headerRes = await c.env.ASSETS.fetch(new URL('/header.html', c.req.url));
    const footerRes = await c.env.ASSETS.fetch(new URL('/footer.html', c.req.url));
    const bodyRes = await c.env.ASSETS.fetch(new URL(`/${templateName}`, c.req.url));

    let header = await headerRes.text();
    let footer = await footerRes.text();
    let body = await bodyRes.text();

    // 替换头部
    header = header.replace('{{page_title}}', data.title || '首页');

    // 替换主体
    for (const [key, value] of Object.entries(data)) {
        body = body.replaceAll(`{{${key}}}`, value !== undefined ? value : '');
    }

    // 拼接
    return c.html(header + body + footer);
}

// --- 短代码解析 (含 [reply]) ---
async function parseShortcodes(c, content, userVipLevel = 0, hasBought = false, userId = null, postId = null) {
  if (!content) return '';

  // [vip]
  content = content.replace(/\[vip\]([\s\S]*?)\[\/vip\]/g, (match, inner) => {
    if (userVipLevel >= 1) return `<div class="vip-box unlocked"><i class="fa-solid fa-unlock"></i> VIP内容：${inner}</div>`;
    return `<div class="vip-box locked"><i class="fa-solid fa-lock"></i><h3>VIP 会员可见</h3><button onclick="buyVip()" class="btn-lock">开通会员</button></div>`;
  });
  
  // [svip]
  content = content.replace(/\[svip\]([\s\S]*?)\[\/svip\]/g, (match, inner) => {
    if (userVipLevel >= 2) return `<div class="vip-box unlocked svip"><i class="fa-solid fa-crown"></i> SVIP内容：${inner}</div>`;
    return `<div class="vip-box locked svip"><i class="fa-solid fa-crown"></i><h3>SVIP 至尊可见</h3><button onclick="buyVip()" class="btn-lock">开通SVIP</button></div>`;
  });

  // [pay]
  content = content.replace(/\[pay\]([\s\S]*?)\[\/pay\]/g, (match, inner) => {
    if (hasBought) return `<div class="pay-box unlocked"><i class="fa-solid fa-check-circle"></i> 已购买：${inner}</div>`;
    return `<div class="pay-box locked"><i class="fa-solid fa-coins"></i><h3>付费内容</h3><button onclick="buyPost()" class="btn-lock">立即购买</button></div>`;
  });

  // [reply] 回复可见
  if (content.includes('[reply]') && postId) {
      let hasReplied = false;
      if (userId) {
          const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM comments WHERE user_id=? AND post_id=?').bind(userId, postId).first();
          if (count.c > 0) hasReplied = true;
      }
      
      content = content.replace(/\[reply\]([\s\S]*?)\[\/reply\]/g, (match, inner) => {
          if (hasReplied) return `<div class="reply-box unlocked"><i class="fa-solid fa-comment-dots"></i> 回复内容：${inner}</div>`;
          return `<div class="reply-box locked"><i class="fa-solid fa-comment-slash"></i><h3>回复可见</h3><p>评论后刷新页面查看</p><a href="#commentList" class="btn-lock" style="text-decoration:none">去评论</a></div>`;
      });
  }

  return content;
}

// --- 路由处理 ---

// 1. 首页
app.get('/', async (c) => {
    return renderPage(c, 'index.html', { title: '首页' });
});

// 2. 文章页
app.get('/:category/:id.html', async (c) => {
  const id = c.req.param('id');
  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
  if (!post) return c.notFound();

  // 默认渲染未解锁状态 (前端 Token 登录后二次获取解锁)
  const content = await parseShortcodes(c, post.content, 0, false, null, id);

  return renderPage(c, 'post.html', {
      title: post.title,
      date: new Date(post.created_at * 1000).toISOString().slice(0,10),
      price: post.price || 0,
      content: content,
      id: post.id,
      like_count: post.like_count || 0
  });
});

// 3. 登录后获取完整文章内容 (解锁接口)
app.get('/api/posts/content/:id', jwt(jwtConfig), async (c) => {
    const user = c.get('jwtPayload');
    const id = c.req.param('id');
    const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(id).first();
    
    let hasBought = false;
    if (post.price > 0) {
        const order = await c.env.DB.prepare('SELECT id FROM orders WHERE user_id=? AND related_id=? AND status="paid"').bind(user.sub, id).first();
        if (order) hasBought = true;
    }
    
    const content = await parseShortcodes(c, post.content, user.vip_level, hasBought, user.sub, id);
    return c.json({ success: true, content });
});

// 4. 文章列表API
app.get('/api/posts/list', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '10');
  const offset = (page - 1) * limit;
  const { results } = await c.env.DB.prepare(`SELECT id, title, slug, thumbnail_url, content, price, view_permission, created_at FROM posts WHERE status = 'published' ORDER BY id DESC LIMIT ? OFFSET ?`).bind(limit, offset).all();
  const total = await c.env.DB.prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'published'").first();
  const posts = results.map(p => {
    const plainText = p.content ? p.content.replace(/<[^>]+>/g, '').substring(0, 100) + '...' : '';
    return { ...p, excerpt: plainText, content: undefined }; 
  });
  return c.json({ success: true, data: posts, total: total.count, page, totalPages: Math.ceil(total.count / limit) });
});

// 5. 上传
app.post('/api/upload', async (c) => {
  const body = await c.req.parseBody(); const file = body['file']; if (!file) return c.json({ error: 'No file' }, 400);
  const fileName = `images/${Date.now()}_${file.name}`;
  await c.env.IMG_BUCKET.put(fileName, file);
  return c.json({ success: true, url: `/images/${fileName}` });
});

app.get('/images/*', async (c) => {
  const key = c.req.path.substring(1); const object = await c.env.IMG_BUCKET.get(key); if (!object) return c.text('404', 404);
  const h = new Headers(); object.writeHttpMetadata(h); h.set('etag', object.httpEtag); return new Response(object.body, { headers: h });
});

app.get('/*', async (c) => { return c.env.ASSETS.fetch(c.req.raw); });

export default app;
