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

// --- 全局中间件 ---
app.use('/*', cors());

// --- 挂载子模块 ---
app.route('/api/auth', auth);
app.route('/api/pay', pay);

// --- API 权限保护 ---
app.use('/api/user/*', jwt({ secret: (c) => c.env.JWT_SECRET }));
app.use('/api/pay/create', jwt({ secret: (c) => c.env.JWT_SECRET }));

// --- 基础 API ---
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

// --- 核心功能：文章渲染与短代码解析 ---

// 辅助函数：解析短代码并进行权限控制
function parseShortcodes(content, userVipLevel = 0, hasBought = false) {
  if (!content) return '';

  // 1. [vip] 标签解析
  // 规则：[vip]内容[/vip] -> 如果 vip_level < 1，显示锁
  content = content.replace(/\[vip\]([\s\S]*?)\[\/vip\]/g, (match, inner) => {
    if (userVipLevel >= 1) return `<div class="vip-box unlocked"><i class="fa-solid fa-unlock"></i> VIP内容已解锁：<br>${inner}</div>`;
    return `<div class="vip-box locked">
              <i class="fa-solid fa-lock"></i> 
              <h3>此内容仅限 VIP 会员查看</h3>
              <p>请开通会员或购买文章解锁</p>
              <button onclick="buyVip()" class="btn-lock">立即开通会员</button>
            </div>`;
  });

  // 2. [svip] 标签解析
  content = content.replace(/\[svip\]([\s\S]*?)\[\/svip\]/g, (match, inner) => {
    if (userVipLevel >= 2) return `<div class="vip-box unlocked svip"><i class="fa-solid fa-crown"></i> SVIP内容已解锁：<br>${inner}</div>`;
    return `<div class="vip-box locked svip">
              <i class="fa-solid fa-crown"></i> 
              <h3>此内容仅限 SVIP 至尊会员查看</h3>
              <button onclick="buyVip()" class="btn-lock">开通SVIP</button>
            </div>`;
  });

  // 3. [pay] 标签解析 (单篇付费)
  // 规则：[pay]内容[/pay] -> 如果 hasBought 为 true，显示内容
  content = content.replace(/\[pay\]([\s\S]*?)\[\/pay\]/g, (match, inner) => {
    if (hasBought) return `<div class="pay-box unlocked"><i class="fa-solid fa-check-circle"></i> 已购买内容：<br>${inner}</div>`;
    return `<div class="pay-box locked">
              <i class="fa-solid fa-coins"></i> 
              <h3>此内容需要付费购买</h3>
              <p>支持支付宝当面付，自动解锁</p>
              <button onclick="buyPost()" class="btn-lock">立即购买</button>
            </div>`;
  });

  return content;
}

// 路由：拦截 /分类名/数字ID.html (例如 /tech/1.html)
app.get('/:category/:id.html', async (c) => {
  const id = c.req.param('id');
  const categorySlug = c.req.param('category'); // 虽然目前没用它查库，但URL需要

  // 1. 查文章
  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
  if (!post) return c.notFound();

  // 2. 获取当前用户权限 (从 Cookie 或 Header 尝试获取 Token)
  // 注意：浏览器直接访问 HTML 时通常没法带 Authorization Header，
  // 这里简化处理：前端 JS 加载后通过 API 二次检查，或者依赖 Cookie。
  // *为了SEO和首屏速度，这里默认先按“游客”渲染，敏感内容前端再通过 JS 验权刷新* // *或者：配合 cookie-based JWT 实现服务端直接渲染 (代码较复杂，暂按默认游客渲染)*
  let userVipLevel = 0;
  let hasBought = false;

  // 3. 解析内容 (默认游客视角，保护隐私)
  const parsedContent = parseShortcodes(post.content, userVipLevel, hasBought);

  // 4. 读取 HTML 模板
  // 我们尝试从 ASSETS 获取 themes/zwy888/post.html
  let template = await c.env.ASSETS.fetch(new URL('/post.html', c.req.url));
  
  if (template.status !== 200) {
     // 如果没上传 post.html，临时返回简单文本
     return c.html(`<h1>${post.title}</h1><div>${parsedContent}</div>`);
  }
  
  let html = await template.text();

  // 5. 替换模板变量
  html = html.replace(/{{title}}/g, post.title)
             .replace(/{{content}}/g, parsedContent)
             .replace(/{{date}}/g, new Date(post.created_at * 1000).toISOString().slice(0,10))
             .replace(/{{id}}/g, post.id)
             .replace(/{{price}}/g, post.price || 0);

  return c.html(html);
});

// --- 静态资源兜底 ---
app.get('/*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
