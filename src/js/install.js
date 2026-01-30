/**
* 模块: 数据库一键安装/重置
* 访问 /install_umi88_db 触发
*/
import { Hono } from 'hono';
const app = new Hono();

app.get('/', async (c) => {
    const sql = `
    -- 1. 用户表 (Users)
    DROP TABLE IF EXISTS users;
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        qq_number TEXT,
        role TEXT DEFAULT 'user',            -- 'admin' 或 'user'
        vip_level INTEGER DEFAULT 0,         -- 0:普通, 1:VIP, 2:SVIP
        vip_expire_time INTEGER DEFAULT 0,   -- 会员到期时间戳
        balance DECIMAL(10, 2) DEFAULT 0.00, -- 余额
        ip_address TEXT,                     -- 注册IP
        is_banned INTEGER DEFAULT 0,         -- 1=小黑屋
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- 2. 文章表 (Posts)
    -- 注意：为了配合点赞功能，我额外保留了 like_count 和 comment_count 字段
    DROP TABLE IF EXISTS posts;
    CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT,
        content TEXT,
        category_id INTEGER,
        thumbnail_type TEXT DEFAULT 'auto',
        thumbnail_url TEXT,
        price DECIMAL(10, 2) DEFAULT 0.00,
        view_permission INTEGER DEFAULT 0,
        status TEXT DEFAULT 'published',
        like_count INTEGER DEFAULT 0,     -- 点赞数缓存
        comment_count INTEGER DEFAULT 0,  -- 评论数缓存
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- 3. 订单表 (Orders)
    DROP TABLE IF EXISTS orders;
    CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT NOT NULL UNIQUE,
        user_id INTEGER,
        order_type TEXT,
        related_id INTEGER,
        amount DECIMAL(10, 2),
        payment_method TEXT DEFAULT 'alipay',
        trade_no TEXT,
        status TEXT DEFAULT 'pending',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER
    );

    -- 4. 评论表 (Comments)
    DROP TABLE IF EXISTS comments;
    CREATE TABLE comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER,
        user_id INTEGER,
        content TEXT,
        ip_address TEXT,
        is_approved INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- 5. 分类表 (Categories)
    DROP TABLE IF EXISTS categories;
    CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        icon TEXT
    );

    -- 6. 点赞记录表 (Likes) - 必须要有这张表，否则点赞功能会报错
    DROP TABLE IF EXISTS likes;
    CREATE TABLE likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(user_id, post_id)
    );
    `;

    try {
        // 按分号拆分 SQL 语句并批量执行
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        const batch = statements.map(s => c.env.DB.prepare(s));
        await c.env.DB.batch(batch);
        
        return c.html(`
            <div style="font-family:sans-serif; text-align:center; padding:50px;">
                <h1 style="color:#2ecc71; font-size:3rem;">✅ 数据库重置成功！</h1>
                <p style="color:#666; font-size:1.2rem;">所有表结构已更新。</p>
                <hr style="margin:20px auto; width:50%; opacity:0.3;">
                <p><b>下一步：</b></p>
                <p>请回到首页注册一个新账号，它将自动成为 <span style="color:red;font-weight:bold;">超级管理员 (SVIP)</span>。</p>
                <a href="/" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#3498db; color:#fff; text-decoration:none; border-radius:5px;">返回首页注册</a>
            </div>
        `);
    } catch (e) {
        return c.html(`<h1 style="color:red">❌ 初始化失败</h1><pre>${e.message}</pre>`);
    }
});

export default app;
