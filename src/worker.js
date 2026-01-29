/**
* 优米博客 - 专注网络优质资源分享！
* @永久网址 [WWW.UMI88.CC]
* @联系扣扣 [主446099815][副228522198]
* @ 加群交流[唯一官方QQ群:13936509]
* @todo [本程序通过cloudflare加workers加D1数据库加KV空间即可启动]
*/

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import auth from './auth';
import pay from './pay';
import admin from './admin'; // <--- 【新增】引入后台模块

const app = new Hono();

// --- 1. 全局中间件 ---
app.use('/*', cors());

// --- 2. 挂载子模块路由 ---
app.route('/api/auth', auth);
app.route('/api/pay', pay);

// 挂载后台模块 (所有 /api/admin/* 请求交给 admin.js 处理)
app.route('/api/admin', admin);


// --- 3. 权限控制中间件 (JWT) ---

// 保护用户信息接口
app.use('/api/user/*', jwt({ secret: (c) => c.env.JWT_SECRET }));

// 保护创建订单接口
app.use('/api/pay/create', jwt({ secret: (c) => c.env.JWT_SECRET }));

// 【新增】保护后台接口
// 只有带了 Token 才能进入 admin.js 里的逻辑，那里还有第二层 verifyAdmin 检查
app.use('/api/admin/*', jwt({ secret: (c) => c.env.JWT_SECRET }));


// --- 4. 核心功能 API ---

// (A) 图片上传接口 (上传到 R2)
app.post('/api/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];
  if (!file) return c.json({ error: '请选择文件' }, 400);

  // 简单命名，实际可改为 UUID
  const fileName = `images/${Date.now()}_${file.name}`;

  try {
    await c.env.IMG_BUCKET.put(fileName, file);
    return c.json({ success: true, url: `/images/${fileName}` });
  } catch (e) {
    return c.json({ error: '上传失败: ' + e.message }, 500);
  }
});

// (B) 数据库连接测试
app.get('/api/test-db', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM users LIMIT 1').first();
    return c.json({ success: true, msg: '数据库连接正常', data: result });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// (C) 图片查看代理
app.get('/images/*', async (c) => {
  const key = c.req.path.substring(1);
  const object = await c.env.IMG_BUCKET.get(key);
  if (!object) return c.text('404 Not Found', 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  return new Response(object.body, { headers });
});

// --- 5. 文章渲染与短代码解析 (核心) ---
function parseShortcodes(content, userVipLevel = 0, hasBought = false) {
  if (!content) return '';

  // [vip] 标签
  content = content.replace(/\[vip\]([\s\S]*?)\[\/vip\]/g, (match, inner) => {
    if (userVipLevel >= 1) return `<div class="vip-box unlocked"><i class="fa-solid fa-unlock"></i> VIP内容已解锁：<br>${inner}</div>`;
    return `<div class="vip-box locked"><i class="fa-solid fa-lock"></i><h3>VIP 会员可见</h3><button onclick="buyVip()" class="btn-lock">开通会员</button></div>`;
  });

  // [pay] 标签
  content = content.replace(/\[pay\]([\s\S]*?)\[\/pay\]/g, (match, inner) => {
    if (hasBought) return `<div class="pay-box unlocked"><i class="fa-solid fa-check-circle"></i> 已购买：<br>${inner}</div>`;
    return `<div class="pay-box locked"><i class="fa-solid fa-coins"></i><h3>付费内容</h3><button onclick="buyPost()" class="btn-lock">立即购买</button></div>`;
  });

  return content;
}

app.get('/:category/:id.html', async (c) => {
  const id = c.req.param('id');
  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
  if (!post) return c.notFound();

  // 默认按游客渲染 (前端JS可二次刷新)
  const parsedContent = parseShortcodes(post.content, 0, false);
  
  let template = await c.env.ASSETS.fetch(new URL('/post.html', c.req.url));
  let html = await template.text();

  html = html.replace(/{{title}}/g, post.title)
             .replace(/{{content}}/g, parsedContent)
             .replace(/{{date}}/g, new Date(post.created_at * 1000).toISOString().slice(0,10))
             .replace(/{{id}}/g, post.id)
             .replace(/{{price}}/g, post.price || 0);

  return c.html(html);
});


// --- 6. 静态资源兜底 ---
app.get('/*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
