import { Hono } from 'hono';
const app = new Hono();

// 获取某文章的评论
app.get('/list/:postId', async (c) => {
    const postId = c.req.param('postId');
    const comments = await c.env.DB.prepare(`
        SELECT c.id, c.content, c.created_at, u.username, u.qq_number, u.role, u.vip_level 
        FROM comments c 
        JOIN users u ON c.user_id = u.id 
        WHERE c.post_id = ? 
        ORDER BY c.created_at DESC
    `).bind(postId).all();
    return c.json({ success: true, data: comments.results });
});

// 发表评论 (需登录)
app.post('/add', async (c) => {
    const user = c.get('jwtPayload'); // 需在 worker.js 挂载 JWT
    if (!user) return c.json({ error: '请先登录' }, 401);

    const { postId, content } = await c.req.json();
    if(!content || content.length < 2) return c.json({ error: '评论内容太短' }, 400);

    // 写入评论
    await c.env.DB.prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)')
        .bind(postId, user.sub, content).run();
    
    // 更新文章评论数
    await c.env.DB.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').bind(postId).run();

    return c.json({ success: true, message: '评论成功' });
});

// 点赞 (需登录，防重复)
app.post('/like', async (c) => {
    const user = c.get('jwtPayload');
    if (!user) return c.json({ error: '请先登录' }, 401);

    const { postId } = await c.req.json();

    try {
        // 尝试插入点赞记录 (唯一约束会防止重复)
        await c.env.DB.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)')
            .bind(user.sub, postId).run();
        
        // 更新计数
        await c.env.DB.prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').bind(postId).run();
        
        return c.json({ success: true, message: '点赞成功' });
    } catch (e) {
        return c.json({ error: '你已经点过赞了' }, 400);
    }
});

// 获取当前用户是否点赞
app.get('/status/:postId', async (c) => {
    const postId = c.req.param('postId');
    // 如果没带 Token，尝试从 Header 拿
    // 这里简化，由前端判断是否登录，如果没登录直接显示未点赞
    // 如果登录了，前端会带 Authorization 头，中间件会解析到 c.get('jwtPayload')
    const user = c.get('jwtPayload');
    let hasLiked = false;
    
    if (user) {
        const exist = await c.env.DB.prepare('SELECT id FROM likes WHERE user_id=? AND post_id=?').bind(user.sub, postId).first();
        if (exist) hasLiked = true;
    }
    
    // 获取最新点赞数
    const post = await c.env.DB.prepare('SELECT like_count FROM posts WHERE id=?').bind(postId).first();
    
    return c.json({ success: true, hasLiked, likeCount: post?.like_count || 0 });
});

export default app;
