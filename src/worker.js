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
import auth from './auth'; // 引入同目录下的 auth.js

const app = new Hono();

// --- 1. 全局中间件 ---
// 允许跨域 (CORS)
app.use('/*', cors());

// --- 2. 挂载子路由 ---
// 所有 /api/auth/* 的请求都交给 auth.js 处理
app.route('/api/auth', auth);

// --- 3. 受保护路由中间件 (JWT) ---
// 只要是访问 /api/user/* 开头的接口，必须带 Token
app.use('/api/user/*', async (c, next) => {
  const jwtMiddleware = jwt({ secret: c.env.JWT_SECRET });
  return jwtMiddleware(c, next);
});


// --- 4. 主页路由 (前端入口) ---
app.get('/', async (c) => {
  const url = new URL(c.req.url);

  // 如果请求 API 根目录
  if (url.pathname.startsWith('/api')) {
    return c.json({ status: 'Umi Blog API Running', version: '1.0' });
  }

  // 返回简单的测试HTML (后续替换为 themes/zwy888/index.html)
  return c.html(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>优米博客 - UMI88.CC</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 50px; }
        .box { border: 1px solid #ddd; padding: 20px; border-radius: 8px; max-width: 400px; margin: 0 auto; }
        .btn { display: inline-block; margin: 10px; padding: 10px 20px; background: #333; color: #fff; text-decoration: none; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>优米博客开发中</h1>
        <p>Worker 状态: <span style="color:green">运行正常</span></p>
        <p>数据库: <span style="color:green">已连接</span></p>
        <hr>
        <a href="/api/auth/captcha" target="_blank" class="btn">测试验证码API</a>
        <a href="/api/test-db" target="_blank" class="btn">测试数据库连通性</a>
      </div>
    </body>
    </html>
  `);
});

// --- 5. 数据库测试接口 ---
app.get('/api/test-db', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM users LIMIT 1').first();
    return c.json({ 
      success: true, 
      msg: '数据库连接正常', 
      data: result || '暂无用户(这是正常的)' 
    });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// --- 6. 图片上传接口 (R2) ---
app.post('/api/upload', async (c) => {
  // TODO: 这里后续要加上 jwt 验证，只允许管理员上传
  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file) {
    return c.json({ error: '请选择文件' }, 400);
  }

  // 自动命名: images/时间戳_文件名
  const fileName = `images/${Date.now()}_${file.name}`;

  try {
    await c.env.IMG_BUCKET.put(fileName, file);
    return c.json({ 
      success: true, 
      url: `/images/${fileName}` 
    });
  } catch (e) {
    return c.json({ error: '上传失败: ' + e.message }, 500);
  }
});

// --- 7. 图片查看代理 (解决R2访问问题) ---
app.get('/images/*', async (c) => {
  const key = c.req.path.substring(1); // 去掉开头的 /
  const object = await c.env.IMG_BUCKET.get(key);

  if (!object) {
    return c.text('404 Not Found', 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  return new Response(object.body, {
    headers,
  });
});

export default app;
