/**
* 优米博客 - 核心 Worker (JWT 修复版 + 数据库一键安装)
*/
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import auth from './auth';
import pay from './pay';
import admin from './admin';
import comments from './comments';

const app = new Hono();

// --- 1. 全局配置 ---
app.use('/*', cors());

// --- 2. 挂载子路由 ---
app.route('/api/auth', auth);
app.route('/api/pay', pay);
app.route('/api/admin', admin);
app.route('/api/comments', comments);

// --- 3. JWT 权限校验配置 (关键修复：必须带 alg: 'HS256') ---
const jwtConfig = { 
  secret: (c) => c.env.JWT_SECRET, 
  alg: 'HS256' 
};

// 需要登录的接口
app.use('/api/user/*', jwt(jwtConfig));
app.use('/api/pay/create', jwt(jwtConfig));
app.use('/api/admin/*', jwt(jwtConfig));
app.use('/api/comments/add', jwt(jwtConfig));
app.use('/api/comments/like', jwt(jwtConfig));


// ============================================================
// ⚡️⚡️⚡️ 数据库一键安装/重置接口 ⚡️⚡️⚡️
// ============================================================
app.get('/install_umi88_db', async (c) => {
    const sql = `
    DROP TABLE IF EXISTS users;
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        qq_number TEXT,
        role TEXT DEFAULT 'user',
        vip_level INTEGER DEFAULT 0,
        vip_expire_time INTEGER DEFAULT 0,
        balance DECIMAL(10, 2) DEFAULT 0.00,
        ip_address TEXT,
        is_banned INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    DROP TABLE IF EXISTS posts;
    CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT,
        content TEXT,
        category_id INTEGER,
        thumbnail_type TEXT DEFAULT 'auto',
        thumbnail_url TEXT,
        price DECIMAL(10, 2) DEFAULT 0.00,
        view_permission INTEGER DEFAULT 0,
        status TEXT DEFAULT 'published',
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    DROP TABLE IF EXISTS orders;
    CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT NOT NULL UNIQUE,
        user_id INTEGER,
        order_type TEXT,
        related_id INTEGER,
        amount DECIMAL(10, 2),
        payment_method TEXT DEFAULT 'alipay',
        trade_no TEXT,
        status TEXT DEFAULT 'pending',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER
    );
    DROP TABLE IF EXISTS comments;
    CREATE TABLE comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER,
        user_id INTEGER,
        content TEXT,
        ip_address TEXT,
        is_approved INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    DROP TABLE IF EXISTS categories;
    CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        icon TEXT
    );
    DROP TABLE IF EXISTS likes;
    CREATE TABLE likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(user_id, post_id)
    );
    `;

    try {
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        const batch = statements.map(s => c.env.DB.prepare(s));
        await c.env.DB.batch(batch);
        return c.html(`<h1 style="color:green">✅ 数据库初始化成功！</h1><p>请去首页注册首个账号(自动设为管理员)。</p>`);
    } catch (e) {
        return c.html(`<h1 style="color:red">❌ 初始化失败</h1><pre>${e.message}</pre>`);
    }
});


// --- 4. 页面组装 (SSR) ---
async function renderPage(c, templateName, data = {}) {
    try {
        const headerRes = await c.env.ASSETS.fetch(new URL('/header.html', c.req.url));
        const footerRes = await c.env.ASSETS.fetch(new URL('/footer.html', c.req.url));
        const bodyRes = await c.env.ASSETS.fetch(new URL(`/${templateName}`, c.req.url));

        if (headerRes.status !== 200 || footerRes.status !== 200 || bodyRes.status !== 200) {
            return c.html('<h1>模板文件缺失</h1><p>请检查 themes 目录下是否有 header.html, footer.html 和对应页面文件。</p>');
        }

        let header = await headerRes.text();
        let footer = await footerRes.text();
        let body = await bodyRes.text();

        header = header.replace('{{page_title}}', data.title || '首页');
        for (const [key, value] of Object.entries(data)) {
            body = body.replaceAll(`{{${key}}}`, value !== undefined ? value : '');
        }
        return c.html(header + body + footer);
    } catch (e) {
        return c.text('页面渲染出错: ' + e.message, 500);
    }
}

// --- 5. 短代码解析逻辑 ---
async function parseShortcodes(c, content, userVipLevel = 0, hasBought = false, userId = null, postId = null) {
  if (!content) return '';

  content = content.replace(/\[vip\]([\s\S]*?)\[\/vip\]/g, (match, inner) => {
    if (userVipLevel >= 1) return `<div class="vip-box unlocked"><i class="fa-solid fa-unlock"></i> VIP内容：${inner}</div>`;
    return `<div class="vip-box locked"><i class="fa-solid fa-lock"></i><h3>VIP 会员可见</h3><button onclick="buyVip()" class="btn-lock">开通会员</button></div>`;
  });
  
  content = content.replace(/\[svip\]([\s\S]*?)\[\/svip\]/g, (match, inner) => {
    if (userVipLevel >= 2) return `<div class="vip-box unlocked svip"><i class="fa-solid fa-crown"></i> SVIP内容：${inner}</div>`;
    return `<div class="vip-box locked svip"><i class="fa-solid fa-crown"></i><h3>SVIP 至尊可见</h3><button onclick="buyVip()" class="btn-lock">开通SVIP</button></div>`;
  });

  content = content.replace(/\[pay\]([\s\S]*?)\[\/pay\]/g, (match, inner) => {
    if (hasBought) return `<div class="pay-box unlocked"><i class="fa-solid fa-check-circle"></i> 已购买：${inner}</div>`;
    return `<div class="pay-box locked"><i class="fa-solid fa-coins"></i><h3>付费内容</h3><button onclick="buyPost()" class="btn-lock">立即购买</button></div>`;
  });

  if (content.includes('[reply]') && postId) {
      let hasReplied = false;
      if (userId) {
          try {
            const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM comments WHERE user_id=? AND post_id=?').bind(userId, postId).first();
            if (count && count.c > 0) hasReplied = true;
          } catch(e) {}
      }
      content = content.replace(/\[reply\]([\s\S]*?)\[\/reply\]/g, (match, inner) => {
          if (hasReplied) return `<div class="reply-box unlocked"><i class="fa-solid fa-comment-dots"></i> 回复内容：${inner}</div>`;
          return `<div class="reply-box locked"><i class="fa-solid fa-comment-slash"></i><h3>回复可见</h3><p>评论后刷新页面查看</p><a href="#commentList" class="btn-lock" style="text-decoration:none">去评论</a></div>`;
      });
  }
  return content;
}

// --- 6. 路由处理 ---

app.get('/', async (c) => { 
    return renderPage(c, 'index.html', { title: '首页' }); 
});

app.get('/:category/:id.html', async (c) => {
  const id = c.req.param('id');
  try {
      const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
      if (!post) return c.notFound();
      const content = await parseShortcodes(c, post.content, 0, false, null, id);
      return renderPage(c, 'post.html', {
          title: post.title, 
          date: new Date(post.created_at * 1000).toISOString().slice(0,10),
          price: post.price || 0, 
          content: content, 
          id: post.id, 
          like_count: post.like_count || 0
      });
  } catch (e) {
      return c.text('文章读取失败: ' + e.message, 500);
  }
});

app.get('/api/posts/content/:id', jwt(jwtConfig), async (c) => {
    const user = c.get('jwtPayload'); const id = c.req.param('id');
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

app.get('/api/posts/list', async (c) => {
  try {
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '10');
      const offset = (page - 1) * limit;
      const { results } = await c.env.DB.prepare(`SELECT id, title, slug, thumbnail_url, content, price, view_permission, created_at FROM posts WHERE status = 'published' ORDER BY id DESC LIMIT ? OFFSET ?`).bind(limit, offset).all();
      const totalRes = await c.env.DB.prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'published'").first();
      const total = totalRes ? totalRes.count : 0;
      const posts = (results || []).map(p => {
          const plainText = p.content ? p.content.replace(/<[^>]+>/g, '').substring(0, 100) + '...' : '';
          return { ...p, excerpt: plainText, content: undefined };
      });
      return c.json({ success: true, data: posts, total: total, page: page, totalPages: Math.ceil(total / limit) });
  } catch (e) {
      return c.json({ success: false, message: e.message, data: [] });
  }
});

app.post('/api/upload', async (c) => {
  const body = await c.req.parseBody(); const file = body['file']; if (!file) return c.json({ error: 'No file' }, 400);
  const fileName = `images/${Date.now()}_${file.name}`; await c.env.IMG_BUCKET.put(fileName, file); return c.json({ success: true, url: `/images/${fileName}` });
});

app.get('/images/*', async (c) => {
  const key = c.req.path.substring(1); const object = await c.env.IMG_BUCKET.get(key); if (!object) return c.text('404 Not Found', 404);
  const h = new Headers(); object.writeHttpMetadata(h); h.set('etag', object.httpEtag); return new Response(object.body, { headers: h });
});

app.get('/*', async (c) => { return c.env.ASSETS.fetch(c.req.raw); });

export default app;
