/**
* 优米博客 - 主入口 (模块化重构版)
*/
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';

// 导入子模块
import authModule from './auth';
import payModule from './pay';
import adminModule from './admin';
import commentsModule from './comments';
import installModule from './js/install';
import pagesModule from './js/pages';
import apisModule from './js/apis';
import staticModule from './js/static';

const app = new Hono();

// --- 1. 全局中间件 ---
app.use('/*', cors());

// --- 2. JWT 配置 ---
const jwtConfig = { secret: (c) => c.env.JWT_SECRET, alg: 'HS256' };

// --- 3. 路由挂载 ---

// A. 基础 API 模块
app.route('/api/auth', authModule);
app.route('/api/pay', payModule);
app.route('/api/admin', adminModule);
app.route('/api/comments', commentsModule);

// B. 业务 API 模块 (src/js/apis.js)
// 包含文章列表、内容解锁、上传
// 注意：内容解锁接口需要 JWT 保护
app.use('/api/posts/content/*', jwt(jwtConfig));
app.route('/api', apisModule); 

// C. 数据库安装模块
app.route('/install_umi88_db', installModule);

// D. 页面路由模块 (首页、文章页、后台页)
app.route('/', pagesModule);

// --- 4. 权限保护路由 ---
// 这里补充其他需要保护的路由
app.use('/api/user/*', jwt(jwtConfig));
app.use('/api/pay/create', jwt(jwtConfig));
app.use('/api/admin/*', jwt(jwtConfig));
app.use('/api/comments/add', jwt(jwtConfig));
app.use('/api/comments/like', jwt(jwtConfig));

// E. 静态资源兜底 (最后挂载)
app.route('/', staticModule);

export default app;
