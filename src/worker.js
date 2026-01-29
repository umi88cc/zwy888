name = "zwy888"
main = "src/worker.js"
compatibility_date = "2026-01-28"

# --- 1. 静态资源挂载 ---
# [重要修改] 目录改为 "themes"，去掉了 "zwy888"
[assets]
directory = "themes"
binding = "ASSETS"

# --- 2. 数据库绑定 (D1) ---
[[d1_databases]]
binding = "DB"
database_name = "zwy888"
database_id = "194ecc7d-9b50-44b8-b4f9-2873913ade0c"

# --- 3. 缓存绑定 (KV) ---
[[kv_namespaces]]
binding = "KV"
id = "690d2289da634615bcf17c078c23d475"

# --- 4. 图片存储绑定 (R2) ---
[[r2_buckets]]
binding = "IMG_BUCKET"
bucket_name = "zwy888"

# --- 5. 环境变量 ---
[vars]
R2_ACCOUNT_ID = "62581a5acbb0f2b76a2c28dd4169f14c"
ALLOWED_EXTENSIONS = "jpg,jpeg,png,gif,webp"
