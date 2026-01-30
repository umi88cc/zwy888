name = "zwy888"
main = "src/worker.js"
compatibility_date = "2026-01-28"

# --- 1. 静态资源配置 ---
# 设置为根目录，以便 Worker 可以读取 /admin 下的受保护文件
[assets]
directory = "./"
binding = "ASSETS"
# ⚠️ 严防死守：排除所有非公开资源，确保源码不被下载
exclude = ["src", "node_modules", "package.json", "wrangler.toml", ".*", "admin/index.js", "admin/modules/**/*.js"]

# --- 2. 数据库与变量 (保持不变) ---
[[d1_databases]]
binding = "DB"
database_name = "zwy888"
database_id = "194ecc7d-9b50-44b8-b4f9-2873913ade0c"

[[kv_namespaces]]
binding = "KV"
id = "690d2289da634615bcf17c078c23d475"

[[r2_buckets]]
binding = "IMG_BUCKET"
bucket_name = "zwy888"

[vars]
R2_ACCOUNT_ID = "62581a5acbb0f2b76a2c28dd4169f14c"
ALLOWED_EXTENSIONS = "jpg,jpeg,png,gif,webp"
JWT_SECRET = "umi88_secure_password_key_2026"
