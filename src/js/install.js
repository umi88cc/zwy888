/**
* 模块: 数据库一键安装
*/
import { Hono } from 'hono';
const app = new Hono();

app.get('/', async (c) => {
    const sql = `
    DROP TABLE IF EXISTS users;
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        qq_number TEXT,
        role TEXT DEFAULT 'user',
        vip_level INTEGER DEFAULT 0,
        vip_expire_time INTEGER DEFAULT 0,
        balance DECIMAL(10, 2) DEFAULT 0.00,
        ip_address TEXT,
        is_banned INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
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
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
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
    DROP TABLE IF EXISTS categories;
    CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        icon TEXT
    );
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
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        const batch = statements.map(s => c.env.DB.prepare(s));
        await c.env.DB.batch(batch);
        return c.html(`<h1 style="color:green">✅ 数据库初始化成功！</h1><p>请去首页注册首个账号(自动设为管理员)。</p>`);
    } catch (e) {
        return c.html(`<h1 style="color:red">❌ 初始化失败</h1><pre>${e.message}</pre>`);
    }
});

export default app;
