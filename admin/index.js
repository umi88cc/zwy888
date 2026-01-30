/**
* 后台逻辑总入口
* 作用：聚合所有后台 API，供 Worker 挂载
*/
import { Hono } from 'hono';
// 引入同目录下的子模块
import postsModule from './modules/posts.js';
import usersModule from './modules/users.js';
import settingsModule from './modules/settings.js';
import commentsModule from './modules/comments.js';

const adminApp = new Hono();

// 挂载子功能模块
// 对应的 API 路径将变为: /api/admin/posts/..., /api/admin/users/...
adminApp.route('/posts', postsModule);
adminApp.route('/users', usersModule);
adminApp.route('/settings', settingsModule);
adminApp.route('/comments', commentsModule);

// 可以在这里写一个总的测试接口
adminApp.get('/status', (c) => c.json({ status: 'Admin core is running' }));

export default adminApp;
