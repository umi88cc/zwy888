/**
* 优米博客 - 专注网络优质资源分享！
* @永久网址 [WWW.UMI88.CC]
* @联系扣扣 [主446099815][副228522198]
* @ 加群交流[唯一官方QQ群:13936509]
* @todo [本程序通过cloudflare加workers加D1数据库加KV空间即可启动]
*/

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// 1. 开启跨域允许 (允许前端从不同域名请求 API)
app.use('/*', cors());

// 2. 首页路由：判断是 API 请求还是 浏览器访问
app.get('/', async (c) => {
  const url = new URL(c.req.url);
  
  // 如果是 API 根路径，返回 JSON
  if (url.pathname.startsWith('/api')) {
    return c.json({ 
      message: 'Umi Blog API is Running!',
      version: '1.0.0',
      time: new Date().toISOString()
    });
  }

  // 否则，返回前端 HTML 主页 (暂时返回简单文字，后续对接 themes/zwy888/index.html)
  return c.html(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>优米博客 - 正在建设中</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 50px; background: #f4f4f4; }
        .logo { color: #ff6b6b; font-size: 24px; font-weight: bold; }
        .card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">UMI88.CC</div>
        <h1>优米博客开发中...</h1>
        <p>后端 Workers 正常运行</p>
        <p>数据库 D1 / 缓存 KV / 存储 R2 已挂载</p>
      </div>
    </body>
    </html>
  `);
});

// --- API 路由区域 (后续我们会在这里加很多功能) ---

// 3. 简单的测试数据库接口 (检查 D1 是否通了)
app.get('/api/test-db', async (c) => {
  try {
    // 从 D1 数据库查询第一个用户
    const result = await c.env.DB.prepare('SELECT * FROM users LIMIT 1').first();
    return c.json({ 
      success: true, 
      data: result || '数据库连接成功，但暂无用户数据' 
    });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 4. 图片上传接口 (R2 核心功能)
app.post('/api/upload', async (c) => {
  // 鉴权检查 (暂时跳过，后续加上 verifyAdmin)
  
  const body = await c.req.parseBody();
  const file = body['file']; // 前端表单字段名为 file

  if (!file) {
    return c.json({ error: '请选择文件' }, 400);
  }

  // 生成文件名：自动命名逻辑 (这里简化为时间戳，后续做 001.png 逻辑)
  const fileName = `images/${Date.now()}_${file.name}`;

  try {
    // 写入 R2 存储桶
    await c.env.IMG_BUCKET.put(fileName, file);
    
    // 返回图片访问链接 (假设你已经把自定义域名绑定到了 R2，或者通过 Worker 代理访问)
    // 临时使用 Worker 代理路径
    return c.json({ 
      success: true, 
      url: `/images/${fileName}` 
    });
  } catch (e) {
    return c.json({ error: '上传失败: ' + e.message }, 500);
  }
});

// 5. 图片查看路由 (代理 R2 图片，解决防盗链和域名问题)
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
