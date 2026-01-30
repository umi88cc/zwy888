import { Hono } from 'hono';
const app = new Hono();

// 获取文章列表
app.get('/', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM posts ORDER BY id DESC').all();
    return c.json({ success: true, data: results });
});

// 保存文章
app.post('/save', async (c) => {
    const data = await c.req.json();
    // ... 数据库保存逻辑 ...
    return c.json({ success: true, message: '已保存' });
});

export default app;
