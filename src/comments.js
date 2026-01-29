import { Hono } from 'hono';
const app = new Hono();

app.get('/list/:postId', async (c) => {
    const postId = c.req.param('postId');
    const comments = await c.env.DB.prepare(`SELECT c.id, c.content, c.created_at, u.username, u.qq_number, u.role, u.vip_level FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = ? ORDER BY c.created_at DESC`).bind(postId).all();
    return c.json({ success: true, data: comments.results });
});

app.post('/add', async (c) => {
    const user = c.get('jwtPayload'); if (!user) return c.json({ error: '请先登录' }, 401);
    const { postId, content } = await c.req.json();
    if(!content || content.length < 2) return c.json({ error: '太短' }, 400);
    await c.env.DB.prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)').bind(postId, user.sub, content).run();
    await c.env.DB.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').bind(postId).run();
    return c.json({ success: true });
});

app.post('/like', async (c) => {
    const user = c.get('jwtPayload'); if (!user) return c.json({ error: '请先登录' }, 401);
    const { postId } = await c.req.json();
    try {
        await c.env.DB.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').bind(user.sub, postId).run();
        await c.env.DB.prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').bind(postId).run();
        return c.json({ success: true });
    } catch (e) { return c.json({ error: '已赞过' }, 400); }
});

app.get('/status/:postId', async (c) => {
    const postId = c.req.param('postId');
    const user = c.get('jwtPayload');
    let hasLiked = false;
    if (user) {
        const exist = await c.env.DB.prepare('SELECT id FROM likes WHERE user_id=? AND post_id=?').bind(user.sub, postId).first();
        if (exist) hasLiked = true;
    }
    const post = await c.env.DB.prepare('SELECT like_count FROM posts WHERE id=?').bind(postId).first();
    return c.json({ success: true, hasLiked, likeCount: post?.like_count || 0 });
});

export default app;
