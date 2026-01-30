/**
* 优米博客 - Worker 主入口 (全栈模块化版)
* 路径: src/worker.js
*/
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';

// 1. 引入后端核心逻辑 (位于根目录 admin 文件夹)
import adminBackend from '../admin/index.js'; 

// 2. 引入前台功能模块 (位于 src/js)
import authModule from './js/auth';
import { adminFirewall } from './js/firewall'; // 引入刚才新建的防火墙

const app = new Hono();

// --- 全局配置 ---
app.use('/*', cors());
const jwtConfig = { secret: (c) => c.env.JWT_SECRET, alg: 'HS256' };

// ==========================================
// A. 后台数据 API (纯逻辑)
// ==========================================

// 1. 挂载后台路由
// 只有 /api/admin 开头的请求，才会进入后端 index.js 处理
app.route('/api/admin', adminBackend);

// 2. 数据接口权限锁 (双重保险)
app.use('/api/admin/*', jwt(jwtConfig));
app.use('/api/admin/*', async (c, next) => {
    const payload = c.get('jwtPayload');
    if (payload.role !== 'admin') {
        return c.json({ error: '权限不足：非管理员' }, 403);
    }
    await next();
});

// ==========================================
// B. 后台静态资源防火墙 (核心保护)
// ==========================================

// 拦截所有对 /admin/modules/ 下文件(html/css)的访问
// 必须携带 Token 才能读取，否则返回 403
app.use('/admin/modules/*', adminFirewall(jwtConfig));

// 如果通过了防火墙，手动去读取文件并返回
// (因为 wrangler.toml 设置了 directory="./"，Worker 有权限读取根目录)
app.get('/admin/modules/*', async (c) => {
    return c.env.ASSETS.fetch(c.req.raw);
});

// ==========================================
// C. 前台页面与公开资源
// ==========================================

// 1. 挂载前台 API (登录/注册/支付)
app.route('/api/auth', authModule);

// 2. 后台唯一入口 (Themes 外壳)
// 当用户访问 https://umi88.cc/admin 时，返回 themes/admin/index.html
app.get('/admin', async (c) => {
    return c.env.ASSETS.fetch(new URL('/themes/admin/index.html', c.req.url));
});

// 3. 静态资源兜底 (Themes 资源)
// 所有其他请求 (css, js, 图片, 首页) 都去 themes 目录找
app.get('/*', async (c) => {
    return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
