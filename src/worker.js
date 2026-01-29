/**
* 优米博客 - 核心 Worker (含模板组装与短代码增强)
*/
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import auth from './auth';
import pay from './pay';
import admin from './admin';
import comments from './comments'; // 新增

const app = new Hono();

app.use('/*', cors());

// --- 挂载路由 ---
app.route('/api/auth', auth);
app.route('/api/pay', pay);
app.route('/api/admin', admin);
app.route('/api/comments', comments); // 新增

// --- JWT 配置 ---
const jwtConfig = { secret: (c) => c.env.JWT_SECRET, alg: 'HS256' };
app.use('/api/user/*', jwt(jwtConfig));
app.use('/api/pay/create', jwt(jwtConfig));
app.use('/api/admin/*', jwt(jwtConfig));
// 评论相关：发表、点赞、检查状态需要登录 (可选，如果是GET可能不需要)
app.use('/api/comments/add', jwt(jwtConfig));
app.use('/api/comments/like', jwt(jwtConfig));
// status 接口可能带 Token 也可能不带，这里不强制拦截，在 handler 里判断
// 为了方便，我们在 comments.js 里自己处理 Authorization 头

// --- 模板组装辅助函数 ---
async function renderPage(c, templateName, data = {}) {
    // 1. 读取公共头部和底部
    const headerRes = await c.env.ASSETS.fetch(new URL('/header.html', c.req.url));
    const footerRes = await c.env.ASSETS.fetch(new URL('/footer.html', c.req.url));
    const bodyRes = await c.env.ASSETS.fetch(new URL(`/${templateName}`, c.req.url));

    let header = await headerRes.text();
    let footer = await footerRes.text();
    let body = await bodyRes.text();

    // 2. 替换头部变量
    header = header.replace('{{page_title}}', data.title || '首页');

    // 3. 替换 Body 变量
    for (const [key, value] of Object.entries(data)) {
        body = body.replaceAll(`{{${key}}}`, value !== undefined ? value : '');
    }

    // 4. 组装
    return c.html(header + body + footer);
}

// --- 短代码解析 (含回复可见逻辑) ---
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

  // [reply] 回复可见 (需要查库)
  // 如果有 [reply] 标签，才去查数据库，节省性能
  if (content.includes('[reply]') && postId) {
      let hasReplied = false;
      if (userId) {
          const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM comments WHERE user_id=? AND post_id=?').bind(userId, postId).first();
          if (count.c > 0) hasReplied = true;
      }
      
      content = content.replace(/\[reply\]([\s\S]*?)\[\/reply\]/g, (match, inner) => {
          if (hasReplied) return `<div class="reply-box unlocked"><i class="fa-solid fa-comment-dots"></i> 回复可见内容：${inner}</div>`;
          return `<div class="reply-box locked"><i class="fa-solid fa-comment-slash"></i><h3>回复可见</h3><p>请在下方评论后刷新页面查看</p><a href="#commentList" class="btn-lock">去评论</a></div>`;
      });
  }

  return content;
}

// --- 路由 ---

// 1. 首页
app.get('/', async (c) => {
    return renderPage(c, 'index.html', { title: '首页' });
});

// 2. 文章页
app.get('/:category/:id.html', async (c) => {
  const id = c.req.param('id');
  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
  if (!post) return c.notFound();

  // 获取用户状态 (尝试解析 Token)
  let userVip = 0;
  let hasBought = false;
  let userId = null;
  
  // 简易 Token 解析 (从 Cookie 或 Header) - 为了SSR渲染
  // 这里简化：Worker SSR 很难直接读 LocalStorage 的 Token，通常需要 Cookie。
  // 妥协方案：默认渲染“未解锁”，前端 JS 检测到 Token 后再异步请求“获取全文接口”或者刷新。
  // **为了支持回复可见的 SSR，建议结合前端 main.js 的二次渲染，或者这里不做处理，全部由前端 main.js 替换内容。**
  // 但为了SEO，我们尽量在后端处理。由于目前架构是 Token 存 LocalStorage，后端拿不到。
  // 方案：默认显示锁。用户登录后，main.js 发送带 Token 的请求获取“完整HTML片段”替换 body。
  // 暂时按“游客”渲染。
  
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

// 3. 登录后获取完整文章内容 (用于解锁)
app.get('/api/posts/content/:id', jwt(jwtConfig), async (c) => {
    const user = c.get('jwtPayload');
    const id = c.req.param('id');
    const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(id).first();
    
    // 检查购买
    let hasBought = false;
    if (post.price > 0) {
        const order = await c.env.DB.prepare('SELECT id FROM orders WHERE user_id=? AND related_id=? AND status="paid"').bind(user.sub, id).first();
        if (order) hasBought = true;
    }
    
    // 重新解析
    const content = await parseShortcodes(c, post.content, user.vip_level, hasBought, user.sub, id);
    return c.json({ success: true, content });
});

// 其他 API (上传、列表) 保持不变，请复制之前的代码...
// (为节省篇幅，这里假设你保留了之前的 upload, posts/list 等接口)
// 请务必把之前的 API 逻辑也粘在这里！

// 静态资源兜底
app.get('/*', async (c) => { return c.env.ASSETS.fetch(c.req.raw); });

export default app;
