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

const app = new Hono();

// --- 1. 全局中间件 ---
// 允许跨域
app.use('/*', cors());

// --- 2. 挂载子模块路由 ---

// 挂载鉴权模块 (/api/auth/login, /api/auth/register ...)
app.route('/api/auth', auth);

// 挂载支付模块 (/api/pay/create, /api/pay/notify ...)
// 注意：部分支付接口需要登录权限，下面会配置中间件
app.route('/api/pay', pay);


// --- 3. 权限控制中间件 (JWT) ---
// 保护用户信息接口
app.use('/api/user/*', async (c, next) => {
  const jwtMiddleware = jwt({ secret: c.env.JWT_SECRET });
  return jwtMiddleware(c, next);
});

// 保护创建订单接口 (必须登录才能买东西)
app.use('/api/pay/create', async (c, next) => {
  const jwtMiddleware = jwt({ secret: c.env.JWT_SECRET });
  return jwtMiddleware(c, next);
});


// --- 4. 核心功能 API ---

// (A) 图片上传接口 (上传到 R2)
app.post('/api/upload', async (c) => {
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

// (B) 数据库连接测试
app.get('/api/test-db', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM users LIMIT 1').first();
    return c.json({ 
      success: true, 
      msg: '数据库连接正常', 
      data: result 
    });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// (C) 图片查看代理 (解决 R2 访问权限问题)
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

// --- 5. 静态资源兜底 (前端页面) ---
// 如果请求不匹配上面的 API，则返回 themes/zwy888 下的 HTML/CSS/JS
app.get('/*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
