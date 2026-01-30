/**
* 文章功能 - 后端逻辑 (修复版)
*/
import { Hono } from 'hono';
const app = new Hono();

// 1. 获取文章列表 API
app.get('/', async (c) => {
    try {
        // 简单粗暴：查询所有文章，按时间倒序
        const { results } = await c.env.DB.prepare(
            'SELECT * FROM posts ORDER BY id DESC'
        ).all();
        return c.json({ success: true, data: results });
    } catch (e) {
        return c.json({ success: false, message: '列表读取失败: ' + e.message });
    }
});

// 2. 获取单篇文章 API (用于编辑回显)
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: post });
});

// 3. 保存/发布文章 API (核心修复)
app.post('/save', async (c) => {
    try {
        const body = await c.req.json();
        
        // --- 核心修复：数据清洗 ---
        // 防止前端传 undefined 导致 SQL 报错
        const id = body.id ? parseInt(body.id) : null;
        const title = body.title || '无标题文章';
        const slug = body.slug || `post-${Date.now()}`;
        const content = body.content || '';
        const price = Number(body.price) || 0;
        const view_permission = Number(body.view_permission) || 0;
        const status = 'published'; // ⚠️ 强制设置为发布状态，确保前台能看到
        const now = Math.floor(Date.now() / 1000);

        if (id) {
            // --- 更新逻辑 ---
            await c.env.DB.prepare(`
                UPDATE posts 
                SET title=?, slug=?, content=?, price=?, view_permission=?, status=?
                WHERE id=?
            `).bind(title, slug, content, price, view_permission, status, id).run();
        } else {
            // --- 新增逻辑 ---
            // 必须包含 created_at
            await c.env.DB.prepare(`
                INSERT INTO posts (title, slug, content, price, view_permission, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(title, slug, content, price, view_permission, status, now).run();
        }

        return c.json({ success: true, message: '发布成功！' });

    } catch (e) {
        // 返回详细错误，方便调试
        return c.json({ success: false, message: '数据库写入失败: ' + e.message }, 500);
    }
});

// 4. 删除文章 API
app.post('/delete', async (c) => {
    const { id } = await c.req.json();
    await c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
    return c.json({ success: true, message: '已删除' });
});

export default app;
