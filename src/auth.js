/**
* 优米博客 - 鉴权模块 (注册自动登录版)
*/
import { Hono } from 'hono';
import { sign } from 'hono/jwt';

const auth = new Hono();

// --- 1. 获取验证码 ---
auth.get('/captcha', async (c) => {
  const num1 = Math.floor(Math.random() * 20); // 数字改小点，方便心算
  const num2 = Math.floor(Math.random() * 20);
  const key = `captcha_${Date.now()}_${Math.random()}`;
  await c.env.KV.put(key, (num1 + num2).toString(), { expirationTtl: 300 });
  return c.json({ success: true, key: key, question: `${num1} + ${num2} = ?` });
});

// --- 2. 用户注册 (含自动登录逻辑) ---
auth.post('/register', async (c) => {
  const { username, password, qq, captchaKey, captchaAnswer } = await c.req.json();

  // 校验
  const realAnswer = await c.env.KV.get(captchaKey);
  if (!realAnswer || realAnswer !== captchaAnswer) return c.json({ success: false, message: '验证码错误' }, 400);
  await c.env.KV.delete(captchaKey);

  if (!username || !password || username.length < 3 || password.length < 5) return c.json({ success: false, message: '账号太短或密码太简单' }, 400);

  const exist = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (exist) return c.json({ success: false, message: '账号已存在' }, 400);

  // 加密与入库
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 判断是否首位用户 (管理员)
  const countResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
  const isFirst = countResult.count === 0;
  const role = isFirst ? 'admin' : 'user';
  const vipLevel = isFirst ? 2 : 0;

  try {
    const res = await c.env.DB.prepare(
      'INSERT INTO users (username, password_hash, qq_number, role, vip_level) VALUES (?, ?, ?, ?, ?) RETURNING id'
    ).bind(username, passwordHash, qq || '10000', role, vipLevel).first();

    // 【新增】注册成功直接签发 Token (实现自动登录)
    const payload = {
        sub: res.id,
        role: role,
        vip: vipLevel,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, 
    };
    const token = await sign(payload, c.env.JWT_SECRET, 'HS256');

    return c.json({ 
      success: true, 
      message: '注册成功，正在跳转...',
      token: token, // 返回 Token
      user: {
          id: res.id,
          username: username,
          role: role,
          vip_level: vipLevel,
          avatar: `http://q.qlogo.cn/headimg_dl?dst_uin=${qq||'10000'}&spec=100`
      }
    });

  } catch (e) {
    return c.json({ success: false, message: '注册失败: ' + e.message }, 500);
  }
});

// --- 3. 用户登录 ---
auth.post('/login', async (c) => {
  const { username, password, captchaKey, captchaAnswer } = await c.req.json();

  const realAnswer = await c.env.KV.get(captchaKey);
  if (!realAnswer || realAnswer !== captchaAnswer) return c.json({ success: false, message: '验证码错误' }, 400);
  await c.env.KV.delete(captchaKey);

  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?').bind(username, passwordHash).first();
  if (!user) return c.json({ success: false, message: '账号或密码错误' }, 401);
  if (user.is_banned) return c.json({ success: false, message: '账号被封禁' }, 403);

  const payload = {
    sub: user.id,
    role: user.role,
    vip: user.vip_level,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, 
  };
  const token = await sign(payload, c.env.JWT_SECRET, 'HS256');

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
