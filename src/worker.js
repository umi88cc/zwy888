/**
* 优米博客 - Worker 主入口
* 作用：连接前端 (Themes) 与 后端 (Admin Core)
*/
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';

// 1. 引入根目录下的 admin 后台逻辑
// (../admin/index.js 指向根目录下的 admin 文件夹)
import adminBackend from '../admin/index.js'; 

// 2. 引入前台逻辑 (认证、支付等)
// (./js/auth 指向 src/js/auth.js)
import authModule from './js/auth';

const app = new Hono();

// --- 全局配置 ---
app.use('/*', cors());
const jwtConfig = { secret: (c) => c.env.JWT_SECRET, alg: 'HS256' };

// --- A. 挂载后台逻辑 (核心) ---
// 只有 /api/admin 开头的请求，才会进入后端逻辑处理
app.route('/api/admin', adminBackend);

// --- B. 后台权限锁 (严防死守) ---
// 1. 必须带 Token
app.use('/api/admin/*', jwt(jwtConfig));

// 2. 必须是管理员角色
app.use('/api/admin/*', async (c, next) => {
    const payload = c.get('jwtPayload');
    if (payload.role !== 'admin') {
        return c.json({ error: '权限不足：非管理员' }, 403);
    }
    await next();
});

// --- C. 其他前台 API ---
app.route('/api/auth', authModule);

// --- D. 静态资源托管 ---

// 特殊路由：访问 /admin 时，强制返回后台外壳文件
// 注意：wrangler.toml 里必须配置 [assets] directory = "./themes"
app.get('/admin', async (c) => {
    // 这里的路径对应 themes/admin/index.html
    return c.env.ASSETS.fetch(new URL('/admin/index.html', c.req.url));
});

// 兜底：所有其他请求都去 themes 目录下找文件 (如 css, js, 首页 html)
app.get('/*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
