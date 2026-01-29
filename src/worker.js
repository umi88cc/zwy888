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

const app = new Hono();

// --- 1. 全局中间件 ---
app.use('/*', cors());

// --- 2. 挂载 API 子路由 ---
// 所有 /api/auth/* 的请求都交给 auth.js 处理
app.route('/api/auth', auth);

// --- 3. 受保护路由 (JWT) ---
app.use('/api/user/*', async (c, next) => {
  const jwtMiddleware = jwt({ secret: c.env.JWT_SECRET });
  return jwtMiddleware(c, next);
});

// --- 4. 核心逻辑：API 与 静态页面分离 ---

// (A) 图片上传接口
app.post('/api/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];
  if (!file) return c.json({ error: '请选择文件' }, 400);

  const fileName = `images/${Date.now()}_${file.name}`;
  try {
    await c.env.IMG_BUCKET.put(fileName, file);
    return c.json({ success: true, url: `/images/${fileName}` });
  } catch (e) {
    return c.json({ error: '上传失败: ' + e.message }, 500);
  }
});

// (B) 数据库测试接口
app.get('/api/test-db', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM users LIMIT 1').first();
    return c.json({ success: true, msg: '数据库连接正常', data: result });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// (C) 图片查看代理 (R2)
app.get('/images/*', async (c) => {
  const key = c.req.path.substring(1);
  const object = await c.env.IMG_BUCKET.get(key);
  if (!object) return c.text('404 Not Found', 404);
  
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  return new Response(object.body, { headers });
});

// --- 5. 兜底路由：返回前端页面 (Themes) ---
// 如果请求的不是 API，就去 themes/zwy888 文件夹里找对应的 HTML/CSS/JS
app.get('/*', async (c) => {
  // 这里的 c.env.ASSETS 是我们在 wrangler.toml 里配置的 [assets]
  // 它会自动去 GitHub 的 themes/zwy888 目录找文件
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
