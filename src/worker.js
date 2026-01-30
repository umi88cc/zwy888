/**
* 优米博客 - 主入口 (路径重构版)
*/
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';

// 修改引用路径: 指向 src/js/ 目录
import authModule from './js/auth';
import payModule from './js/pay';
import adminModule from './js/admin';
import commentsModule from './js/comments';
import installModule from './js/install';
import pagesModule from './js/pages';
import apisModule from './js/apis';
import staticModule from './js/static';

const app = new Hono();

app.use('/*', cors());
const jwtConfig = { secret: (c) => c.env.JWT_SECRET, alg: 'HS256' };

// --- 路由挂载 ---
app.route('/api/auth', authModule);
app.route('/api/pay', payModule);
app.route('/api/admin', adminModule);
app.route('/api/comments', commentsModule);

// 业务 API
app.use('/api/posts/content/*', jwt(jwtConfig));
app.route('/api', apisModule); 

// 安装 & 页面
app.route('/install_umi88_db', installModule);
app.route('/', pagesModule);

// 权限保护
app.use('/api/user/*', jwt(jwtConfig));
app.use('/api/pay/create', jwt(jwtConfig));
app.use('/api/admin/*', jwt(jwtConfig));
app.use('/api/comments/add', jwt(jwtConfig));
app.use('/api/comments/like', jwt(jwtConfig));

// 静态资源
app.route('/', staticModule);

export default app;
