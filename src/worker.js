import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';

// 1. 引入根目录下的 admin 后台逻辑
// 注意：这里使用相对路径跳出 src 目录去引用 admin 目录
import adminBackend from '../admin/index.js'; 

// 引入其他前台逻辑 (假设你放在 src/js 下)
import authModule from './js/auth';

const app = new Hono();
app.use('/*', cors());
const jwtConfig = { secret: (c) => c.env.JWT_SECRET, alg: 'HS256' };

// --- A. 挂载后台逻辑 (核心步骤) ---
// 只有通过 /api/admin 访问的请求，才会进入 admin/index.js 处理
app.route('/api/admin', adminBackend);

// --- B. 权限保护 ---
// 强制要求访问 /api/admin/* 必须带 Token
app.use('/api/admin/*', jwt(jwtConfig));

// 鉴权拦截器：额外判断角色是否为 admin
app.use('/api/admin/*', async (c, next) => {
    const payload = c.get('jwtPayload');
    if (payload.role !== 'admin') {
        return c.json({ error: '权限不足：非管理员' }, 403);
    }
    await next();
});

// --- C. 其他路由 ---
app.route('/api/auth', authModule);

// --- D. 静态资源托管 (Themes) ---
// 访问 /admin 时，返回 themes/admin/index.html
app.get('/admin', async (c) => {
    return c.env.ASSETS.fetch(new URL('/themes/admin/index.html', c.req.url));
});

// 兜底：所有其他请求走静态资源 (themes 目录)
app.get('/*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
