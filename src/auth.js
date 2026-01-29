/**
* 优米博客 - 专注网络优质资源分享！
* @永久网址 [WWW.UMI88.CC]
* @联系扣扣 [主446099815][副228522198]
* @ 加群交流[唯一官方QQ群:13936509]
* @todo [本程序通过cloudflare加workers加D1数据库加KV空间即可启动]
*/

import { Hono } from 'hono';
import { sign } from 'hono/jwt';

const auth = new Hono();

// --- 辅助函数：密码加密 (SHA-256) ---
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- 1. 获取验证码接口 (50以内加减法) ---
auth.get('/captcha', async (c) => {
  // 生成两个 0-25 之间的随机数
  const num1 = Math.floor(Math.random() * 25);
  const num2 = Math.floor(Math.random() * 25);
  const isAdd = Math.random() > 0.5;
  
  let question, answer;
  if (isAdd) {
    question = `${num1} + ${num2} = ?`;
    answer = num1 + num2;
  } else {
    // 减法确保大减小
    const max = Math.max(num1, num2);
    const min = Math.min(num1, num2);
    question = `${max} - ${min} = ?`;
    answer = max - min;
  }

  // 生成唯一Key (有效期300秒)
  const key = `captcha_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  await c.env.KV.put(key, answer.toString(), { expirationTtl: 300 });

  return c.json({ 
    success: true, 
    key: key, 
    question: question 
  });
});

// --- 2. 注册接口 (自动识别首位管理员) ---
auth.post('/register', async (c) => {
  try {
    const { username, password, qq, captchaKey, captchaAnswer } = await c.req.json();

    // A. 验证码校验
    const realAnswer = await c.env.KV.get(captchaKey);
    if (!realAnswer || realAnswer !== captchaAnswer.toString()) {
      return c.json({ success: false, message: '验证码错误或已失效' }, 400);
    }
    await c.env.KV.delete(captchaKey); // 用完即焚

    // B. QQ号简单校验
    if (!/^\d{5,12}$/.test(qq)) {
      return c.json({ success: false, message: '请输入真实的QQ号' }, 400);
    }

    // C. 查重
    const exist = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
    if (exist) {
      return c.json({ success: false, message: '该账号已被注册' }, 400);
    }

    // D. 自动设为管理员逻辑 (如果没有用户，则第一人为admin)
    const userCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
    const isFirstUser = userCount.count === 0;
    const role = isFirstUser ? 'admin' : 'user';
    const vipLevel = isFirstUser ? 2 : 0; // 管理员默认SVIP

    // E. 写入数据库
    const passwordHash = await hashPassword(password);
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';

    await c.env.DB.prepare(
      'INSERT INTO users (username, password_hash, qq_number, role, vip_level, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(username, passwordHash, qq, role, vipLevel, ip).run();

    return c.json({ success: true, message: '注册成功！' });

  } catch (e) {
    return c.json({ success: false, message: '注册异常: ' + e.message }, 500);
  }
});

// --- 3. 登录接口 (含小黑屋检测) ---
auth.post('/login', async (c) => {
  try {
    const { username, password, captchaKey, captchaAnswer } = await c.req.json();

    // A. 验证码校验
    const realAnswer = await c.env.KV.get(captchaKey);
    if (!realAnswer || realAnswer !== captchaAnswer.toString()) {
      return c.json({ success: false, message: '验证码错误' }, 400);
    }
    await c.env.KV.delete(captchaKey);

    // B. 数据库查询用户
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
    if (!user) {
      return c.json({ success: false, message: '账号不存在' }, 404);
    }

    // C. 小黑屋检测
    if (user.is_banned === 1) {
      return c.json({ success: false, message: '您的账号已被封禁 (小黑屋)，无法登录' }, 403);
    }

    // D. 密码比对
    const inputHash = await hashPassword(password);
    if (inputHash !== user.password_hash) {
      return c.json({ success: false, message: '密码错误' }, 401);
    }

    // E. 签发 Token (JWT)
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7天过期
    };
    const token = await sign(payload, c.env.JWT_SECRET);

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
