/**
* 模块: 前端页面路由 (首页、文章详情、后台入口)
*/
import { Hono } from 'hono';
import { renderPage, parseShortcodes } from './utils';

const app = new Hono();

// 1. 首页
app.get('/', async (c) => { 
    return renderPage(c, 'home', 'index.html', { title: '首页 - 优米博客' }); 
});

// 2. 后台入口 (页面)
app.get('/admin', async (c) => {
    return renderPage(c, 'admin', 'index.html', { title: '后台管理' });
});

// 3. 文章详情页
app.get('/:category/:id.html', async (c) => {
  const id = c.req.param('id');
  try {
      const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
      if (!post) return c.notFound();
      
      // 默认游客状态渲染 (前端 JS 会在登录后二次请求解锁)
      const content = await parseShortcodes(c, post.content, 0, false, null, id);
      
      return renderPage(c, 'post', 'index.html', {
          title: post.title, 
          date: new Date(post.created_at * 1000).toISOString().slice(0,10),
          price: post.price || 0, 
          content: content, 
          id: post.id, 
          like_count: post.like_count || 0
      });
  } catch (e) {
      return c.text('页面加载错误: ' + e.message, 500);
  }
});

export default app;
