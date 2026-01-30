/**
* 后台文章管理模块 (修复版)
* 路径: admin/modules/posts.js
*/
import { Hono } from 'hono';
const app = new Hono();

// 1. 获取文章列表 (只查必要的字段，按 ID 倒序)
app.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare(
            'SELECT id, title, status, price, view_permission, created_at FROM posts ORDER BY id DESC'
        ).all();
        return c.json({ success: true, data: results });
    } catch (e) {
        return c.json({ success: false, message: '读取列表失败: ' + e.message }, 500);
    }
});

// 2. 获取单篇详情
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: post });
});

// 3. 保存文章 (重写了逻辑，防止字段缺失报错)
app.post('/save', async (c) => {
    try {
        const body = await c.req.json();
        
        // 1. 提取字段，并给默认值 (防止 undefined 报错)
        const id = body.id; // 如果有ID就是修改，没有就是新增
        const title = body.title;
        const slug = body.slug || ''; // 默认空
        const content = body.content || ''; 
        const price = Number(body.price) || 0;
        const view_permission = Number(body.view_permission) || 0;
        const status = 'published'; // ⚠️ 强制设为发布状态，防止变成 draft 前端不显示
        const thumbnail_url = body.thumbnail_url || '';
        const now = Math.floor(Date.now() / 1000);

        if (!title || !content) {
            return c.json({ success: false, message: '标题和内容必须填写' }, 400);
        }

        if (id) {
            // --- 更新 ---
            await c.env.DB.prepare(`
                UPDATE posts 
                SET title=?, slug=?, content=?, price=?, view_permission=?, status=?, thumbnail_url=?
                WHERE id=?
            `).bind(title, slug, content, price, view_permission, status, thumbnail_url, id).run();
        } else {
            // --- 新增 ---
            await c.env.DB.prepare(`
                INSERT INTO posts (title, slug, content, price, view_permission, status, thumbnail_url, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(title, slug, content, price, view_permission, status, thumbnail_url, now).run();
        }

        return c.json({ success: true, message: '保存成功' });

    } catch (e) {
        // 返回具体错误信息，方便调试
        return c.json({ success: false, message: '数据库错误: ' + e.message }, 500);
    }
});

// 4. 删除
app.post('/delete', async (c) => {
    const { id } = await c.req.json();
    await c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
    return c.json({ success: true, message: '已删除' });
});

export default app;
