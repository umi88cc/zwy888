/**
 * src/worker.js
 * 优米博客核心后端逻辑
 */

// 简单的密码哈希辅助函数 (使用 SHA-256)
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 生成随机 Token (UUID v4 风格)
function generateToken() {
  return crypto.randomUUID();
}

// 统一响应辅助函数
const response = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // 允许跨域，生产环境建议指定具体域名
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 1. 处理 OPTIONS 预检请求 (CORS)
    if (method === "OPTIONS") {
      return response(null, 204);
    }

    // API 路由前缀检查
    if (!path.startsWith('/api')) {
      // 如果不是 API 请求，这里应该返回前端静态资源 (Assets)
      // 在实际部署中，Cloudflare Pages/Workers Sites 会自动处理静态资源
      // 这里为了演示后端逻辑，非 API 请求返回 404
      return new Response("Not Found", { status: 404 });
    }

    // ================= 认证模块 (Auth) =================

    // 2. 用户注册接口: POST /api/auth/register
    if (path === '/api/auth/register' && method === 'POST') {
      try {
        const { username, password, email } = await request.json();

        // 简单验证
        if (!username || !password) {
          return response({ error: '用户名和密码不能为空' }, 400);
        }

        // 检查用户名是否已存在
        const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
        if (existing) {
          return response({ error: '用户名已存在' }, 409);
        }

        // 密码加密
        const passwordHash = await hashPassword(password);

        // 插入数据库 (默认角色为 user)
        const result = await env.DB.prepare(
          'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)'
        ).bind(username, passwordHash, email || null, 'user').run();

        if (result.success) {
          return response({ success: true, message: '注册成功' });
        } else {
          return response({ error: '数据库写入失败' }, 500);
        }
      } catch (e) {
        return response({ error: '注册异常: ' + e.message }, 500);
      }
    }

    // 3. 用户登录接口: POST /api/auth/login
    if (path === '/api/auth/login' && method === 'POST') {
      try {
        const { username, password } = await request.json();

        // 查询用户
        const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();

        if (!user) {
          return response({ error: '用户不存在' }, 401);
        }

        // 验证状态
        if (user.status === 0) {
          return response({ error: '该账号已被封禁' }, 403);
        }

        // 验证密码
        const inputHash = await hashPassword(password);
        if (inputHash !== user.password) {
          return response({ error: '密码错误' }, 401);
        }

        // 生成 Token 并存入 KV
        // Token 有效期设为 24 小时 (86400 秒)
        const token = generateToken();
        const sessionData = JSON.stringify({
          id: user.id,
          username: user.username,
          role: user.role
        });
        
        await env.KV.put(`session:${token}`, sessionData, { expirationTtl: 86400 });

        // 更新最后登录 IP (从 Cloudflare 头获取)
        const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
        ctx.waitUntil(
          env.DB.prepare('UPDATE users SET last_login_ip = ? WHERE id = ?').bind(clientIp, user.id).run()
        );

        return response({
          success: true,
          token: token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            balance: user.balance
          }
        });

      } catch (e) {
        return response({ error: '登录异常: ' + e.message }, 500);
      }
    }

    // 4. 获取当前用户信息 (需要 Token 验证): GET /api/user/me
    if (path === '/api/user/me' && method === 'GET') {
      const token = request.headers.get('Authorization');
      if (!token) return response({ error: '未授权' }, 401);

      // 从 KV 验证 Token
      const session = await env.KV.get(`session:${token}`);
      if (!session) return response({ error: 'Token 无效或已过期' }, 401);

      return response({ success: true, user: JSON.parse(session) });
    }

    // 如果没有匹配的路由
    return response({ error: 'API 路径不存在' }, 404);
  }
};
