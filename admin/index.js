/**
* 后台总路由
*/
import { Hono } from 'hono';
import postsRoute from './modules/posts/route.js';
// import usersRoute from './modules/users/route.js'; 

const app = new Hono();

// 挂载功能模块 API
app.route('/modules/posts', postsRoute);
// app.route('/modules/users', usersRoute);

export default app;
