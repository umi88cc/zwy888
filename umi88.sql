-- 1. 用户表 (Users)
-- 包含：QQ头像获取逻辑、VIP等级(0=普通, 1=VIP, 2=SVIP)、小黑屋状态
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,       -- 账号
    password_hash TEXT NOT NULL,         -- 密码 (存哈希值)
    qq_number TEXT,                      -- QQ号 (用于拉取头像)
    role TEXT DEFAULT 'user',            -- 'admin' 或 'user'
    vip_level INTEGER DEFAULT 0,         -- 0:普通, 1:VIP, 2:SVIP
    vip_expire_time INTEGER DEFAULT 0,   -- 会员到期时间戳
    balance DECIMAL(10, 2) DEFAULT 0.00, -- 余额 (可选，用于预充值)
    ip_address TEXT,                     -- 注册IP
    is_banned INTEGER DEFAULT 0,         -- 1=进小黑屋 (全站封锁)
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 2. 文章表 (Posts)
-- 包含：外链图片、分类别名、权限控制
DROP TABLE IF EXISTS posts;
CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT,                           -- 自定义URL别名 (如 /tech/1.html)
    content TEXT,                        -- 文章HTML内容 (支持短代码)
    category_id INTEGER,                 -- 关联分类
    thumbnail_type TEXT DEFAULT 'auto',  -- 'auto'(首图), 'url'(外链), 'r2'(上传)
    thumbnail_url TEXT,                  -- 缩略图的具体路径
    price DECIMAL(10, 2) DEFAULT 0.00,   -- 0=免费，>0=单篇付费
    view_permission INTEGER DEFAULT 0,   -- 0=全员, 1=VIP, 2=SVIP
    status TEXT DEFAULT 'published',     -- published, draft, trash
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 3. 订单表 (Orders)
-- 包含：自定义订单号 umi20260130001
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL UNIQUE,       -- 逻辑生成：umi + 日期 + 序号
    user_id INTEGER,
    order_type TEXT,                     -- 'vip_month', 'vip_year', 'post_unlock'
    related_id INTEGER,                  -- 关联ID (文章ID 或 VIP等级ID)
    amount DECIMAL(10, 2),               -- 金额
    payment_method TEXT DEFAULT 'alipay',-- 支付方式
    trade_no TEXT,                       -- 支付宝流水号
    status TEXT DEFAULT 'pending',       -- pending(未付), paid(已付), failed(失败)
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER                   -- 支付成功时间
);

-- 4. 评论表 (Comments)
-- 包含：文章关联、IP记录
DROP TABLE IF EXISTS comments;
CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER,
    content TEXT,
    ip_address TEXT,                     -- 用于安全审计
    is_approved INTEGER DEFAULT 1,       -- 1=自动通过
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 5. 分类表 (Categories)
DROP TABLE IF EXISTS categories;
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,           -- 分类别名 (用于URL)
    icon TEXT                            -- 菜单小图标Class
);

-- 初始化管理员 (默认密码 admin888，后续代码中会强制修改)
-- 注意：这里先插入一条数据防止后台无法登录
INSERT INTO users (username, password_hash, qq_number, role, vip_level) 
VALUES ('admin', 'admin_placeholder_hash', '10001', 'admin', 2);
