/**
* 模块: 前台认证 (登录/注册/验证码)
* 路径: src/js/auth.js
*/
import { Hono } from 'hono';
import { sign } from 'hono/jwt';

const auth = new Hono();

// 1. 获取验证码
auth.get('/captcha', async (c) => {
  const num1 = Math.floor(Math.random() * 20);
  const num2 = Math.floor(Math.random() * 20);
  const key = `captcha_${Date.now()}_${Math.random()}`;
  // 验证码有效期 5 分钟
  await c.env.KV.put(key, (num1 + num2).toString(), { expirationTtl: 300 });
  
  return c.json({ 
      success: true, 
      key: key, 
      question: `${num1} + ${num2} = ?` 
  });
});

// 2. 注册接口
auth.post('/register', async (c) => {
  try {
    if (!c.env.JWT_SECRET) {
        return c.json({ success: false, message: '配置错误：缺少 JWT_SECRET' }, 500);
    }

    const { username, password, qq, captchaKey, captchaAnswer } = await c.req.json();

    // A. 验证码校验
    const realAnswer = await c.env.KV.get(captchaKey);
    if (!realAnswer || realAnswer != captchaAnswer) {
        return c.json({ success: false, message: '验证码错误' }, 400);
    }
    await c.env.KV.delete(captchaKey); // 用完即焚

    // B. 基础校验
    if (!username || !password || username.length < 3 || password.length < 5) {
        return c.json({ success: false, message: '账号至少3位，密码至少5位' }, 400);
    }

    // C. 查重
    const exist = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
    if (exist) {
        return c.json({ success: false, message: '账号已存在' }, 400);
    }

    // D. 密码哈希处理 (Web Crypto API)
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // E. 自动判断是否为第一个用户 (管理员逻辑)
    const countResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
    const isFirst = countResult.count === 0;
    const role = isFirst ? 'admin' : 'user';
    const vipLevel = isFirst ? 2 : 0; // 管理员直接给 SVIP

    // F. 写入数据库
    const res = await c.env.DB.prepare(
      'INSERT INTO users (username, password_hash, qq_number, role, vip_level) VALUES (?, ?, ?, ?, ?) RETURNING id'
    ).bind(username, passwordHash, qq || '10000', role, vipLevel).first();

    // G. 注册成功自动登录 (签发 Token)
    const payload = {
        sub: res.id,
        role: role,
        vip: vipLevel,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7天过期
    };
    const token = await sign(payload, c.env.JWT_SECRET, 'HS256');

    return c.json({ 
      success: true, 
      message: '注册成功，自动登录中...',
      token: token,
      user: { 
          id: res.id, 
          username: username, 
          role: role, 
          vip_level: vipLevel, 
          avatar: `http://q.qlogo.cn/headimg_dl?dst_uin=${qq||'10000'}&spec=100` 
      }
    });

  } catch (e) {
    return c.json({ success: false, message: '注册异常: ' + e.message }, 500);
  }
});

// 3. 登录接口
auth.post('/login', async (c) => {
  try {
    if (!c.env.JWT_SECRET) return c.json({ success: false, message: '配置错误：缺少 JWT_SECRET' }, 500);

    const { username, password, captchaKey, captchaAnswer } = await c.req.json();

    // 验证码校验
    const realAnswer = await c.env.KV.get(captchaKey);
    if (!realAnswer || realAnswer != captchaAnswer) {
        return c.json({ success: false, message: '验证码错误' }, 400);
    }
    await c.env.KV.delete(captchaKey);

    // 密码哈希计算
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 查库校验
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?').bind(username, passwordHash).first();
    
    if (!user) return c.json({ success: false, message: '账号或密码错误' }, 401);
    if (user.is_banned) return c.json({ success: false, message: '账号已封禁' }, 403);

    // 签发 Token
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
  } catch (e) {
    return c.json({ success: false, message: '登录异常: ' + e.message }, 500);
  }
});

export default auth;
