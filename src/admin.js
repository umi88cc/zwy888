/**
* 优米博客 - 鉴权模块
* @功能 [注册(首位自动变管理员) | 登录 | 验证码 | JWT签发]
*/
import { Hono } from 'hono';
import { sign } from 'hono/jwt';

const auth = new Hono();

// --- 1. 获取验证码 (简单算术题) ---
auth.get('/captcha', async (c) => {
  const num1 = Math.floor(Math.random() * 50);
  const num2 = Math.floor(Math.random() * 50);
  const key = `captcha_${Date.now()}_${Math.random()}`;
  
  // 存入 KV，5分钟有效
  await c.env.KV.put(key, (num1 + num2).toString(), { expirationTtl: 300 });

  return c.json({
    success: true,
    key: key,
    question: `${num1} + ${num2} = ?`
  });
});

// --- 2. 用户注册 (首位用户自动成为管理员) ---
auth.post('/register', async (c) => {
  const { username, password, qq, captchaKey, captchaAnswer } = await c.req.json();

  // A. 校验验证码
  const realAnswer = await c.env.KV.get(captchaKey);
  if (!realAnswer || realAnswer !== captchaAnswer) {
    return c.json({ success: false, message: '验证码错误或已失效' }, 400);
  }
  await c.env.KV.delete(captchaKey); // 用完即焚

  // B. 校验参数
  if (!username || !password || username.length < 3 || password.length < 5) {
    return c.json({ success: false, message: '账号至少3位，密码至少5位' }, 400);
  }

  // C. 检查用户名是否已存在
  const exist = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (exist) {
    return c.json({ success: false, message: '该账号已存在' }, 400);
  }

  // D. 密码加密 (使用 Web Crypto API SHA-256)
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // E. 【关键】判断是否为第一个用户
  // 如果当前表中没有用户，则新注册的这个就是 Admin (SVIP)
  const countResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
  const isFirstUser = countResult.count === 0;

  const role = isFirstUser ? 'admin' : 'user';
  const vipLevel = isFirstUser ? 2 : 0; // 管理员直接 SVIP

  // F. 写入数据库
  try {
    await c.env.DB.prepare(
      'INSERT INTO users (username, password_hash, qq_number, role, vip_level) VALUES (?, ?, ?, ?, ?)'
    ).bind(username, passwordHash, qq || '', role, vipLevel).run();

    return c.json({ 
      success: true, 
      message: isFirstUser ? '注册成功！您是第一位用户，已自动升级为管理员。' : '注册成功，请登录' 
    });
  } catch (e) {
    return c.json({ success: false, message: '数据库错误: ' + e.message }, 500);
  }
});

// --- 3. 用户登录 ---
auth.post('/login', async (c) => {
  const { username, password, captchaKey, captchaAnswer } = await c.req.json();

  // A. 校验验证码
  const realAnswer = await c.env.KV.get(captchaKey);
  if (!realAnswer || realAnswer !== captchaAnswer) {
    return c.json({ success: false, message: '验证码错误' }, 400);
  }
  await c.env.KV.delete(captchaKey);

  // B. 计算密码哈希
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // C. 查库
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE username = ? AND password_hash = ?'
  ).bind(username, passwordHash).first();

  if (!user) {
    return c.json({ success: false, message: '账号或密码错误' }, 401);
  }

  // D. 检查小黑屋
  if (user.is_banned) {
    return c.json({ success: false, message: '该账号已被封禁' }, 403);
  }

  // E. 签发 JWT Token (有效期 7 天)
  // Payload 中包含 uid, role, vip
  const payload = {
    sub: user.id,
    role: user.role,
    vip: user.vip_level,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, 
  };
  const token = await sign(payload, c.env.JWT_SECRET, 'HS256'); // 必须指定算法

  // F. 返回用户信息 (不含密码)
  return c.json({
    success: true,
    token: token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      vip_level: user.vip_level,
      avatar: `http://q.qlogo.cn/headimg_dl?dst_uin=${user.qq_number}&spec=100`
    }
  });
});

export default auth;
