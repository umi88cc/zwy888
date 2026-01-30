/**
* 后台文章管理模块
* 路径: admin/modules/posts.js
*/
import { Hono } from 'hono';
const app = new Hono();

// 1. 获取文章列表
app.get('/', async (c) => {
    try {
        // 查询 ID, 标题, 状态, 价格, 权限, 时间
        const { results } = await c.env.DB.prepare(
            'SELECT id, title, status, price, view_permission, created_at FROM posts ORDER BY id DESC'
        ).all();
        return c.json({ success: true, data: results });
    } catch (e) {
        return c.json({ success: false, message: '数据库查询失败: ' + e.message }, 500);
    }
});

// 2. 获取单篇文章详情 (用于编辑回显)
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    try {
        const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
        if (!post) return c.json({ success: false, message: '文章不存在' }, 404);
        return c.json({ success: true, data: post });
    } catch (e) {
        return c.json({ success: false, message: '读取失败' }, 500);
    }
});

// 3. 保存文章 (新增 或 更新)
app.post('/save', async (c) => {
    try {
        const body = await c.req.json();
        // 提取字段
        const { id, title, slug, content, price, view_permission, status, thumbnail_url } = body;
        const now = Math.floor(Date.now() / 1000);

        // 简单的必填校验
        if (!title || !content) {
            return c.json({ success: false, message: '标题和内容不能为空' }, 400);
        }

        if (id) {
            // --- 更新模式 ---
            await c.env.DB.prepare(`
                UPDATE posts 
                SET title=?, slug=?, content=?, price=?, view_permission=?, status=?, thumbnail_url=?
                WHERE id=?
            `).bind(
                title, 
                slug || '', 
                content, 
                price || 0, 
                view_permission || 0, 
                status || 'published', 
                thumbnail_url || '', 
                id
            ).run();
        } else {
            // --- 新增模式 ---
            await c.env.DB.prepare(`
                INSERT INTO posts (title, slug, content, price, view_permission, status, thumbnail_url, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                title, 
                slug || '', 
                content, 
                price || 0, 
                view_permission || 0, 
                status || 'published', 
                thumbnail_url || '', 
                now
            ).run();
        }

        return c.json({ success: true, message: '保存成功！' });

    } catch (e) {
        console.error(e);
        return c.json({ success: false, message: '数据库错误: ' + e.message }, 500);
    }
});

// 4. 删除文章
app.post('/delete', async (c) => {
    try {
        const { id } = await c.req.json();
        if (!id) return c.json({ success: false, message: 'ID不能为空' }, 400);

        await c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
        return c.json({ success: true, message: '文章已删除' });
    } catch (e) {
        return c.json({ success: false, message: '删除失败' }, 500);
    }
});

export default app;
