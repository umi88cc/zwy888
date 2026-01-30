import { Hono } from 'hono';
const app = new Hono();

// 获取列表 API
app.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare('SELECT id, title, status, price, created_at FROM posts ORDER BY id DESC').all();
        return c.json({ success: true, data: results });
    } catch (e) { return c.json({ success: false, msg: e.message }); }
});

// 保存文章 API
app.post('/save', async (c) => {
    const body = await c.req.json();
    // ... (此处省略具体的数据库 INSERT/UPDATE 代码，逻辑同之前一样) ...
    // 为节省篇幅，建议直接复制之前 posts.js 里的 save 逻辑
    return c.json({ success: true, message: '已保存 (Module)' });
});

export default app;
