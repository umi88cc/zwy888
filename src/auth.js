/**
* 优米博客 - 用户鉴权模块
* @功能 [注册 | 登录 | 验证码 | 黑屋检测]
*/
import { Hono } from 'hono';
import { sign } from 'hono/jwt';

const auth = new Hono();

// --- 辅助函数：密码加密 (使用 Web Crypto API) ---
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- 1. 获取验证码接口 (GET /api/auth/captcha) ---
auth.get('/captcha', async (c) => {
  // 生成两个 0-25 之间的随机数，确保结果在 50 以内
  const num1 = Math.floor(Math.random() * 25);
  const num2 = Math.floor(Math.random() * 25);
  // 随机决定是加法还是减法 (0:加, 1:减)
  const isAdd = Math.random() > 0.5;
  
  let question, answer;
  if (isAdd) {
    question = `${num1} + ${num2} = ?`;
    answer = num1 + num2;
  } else {
    // 减法确保大减小，结果非负
    const max = Math.max(num1, num2);
    const min = Math.min(num1, num2);
    question = `${max} - ${min} = ?`;
    answer = max - min;
  }

  // 生成一个唯一的 key (使用时间戳+随机数)
  const key = `captcha_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // 将答案存入 KV 缓存，有效期 5 分钟 (300秒)
  // key 用于前端提交时比对
  await c.env.KV.put(key, answer.toString(), { expirationTtl: 300 });

  return c.json({ 
    success: true, 
    key: key, 
    question: question 
  });
});

// --- 2. 注册接口 (POST /api/auth/register) ---
auth.post('/register', async (c) => {
  const { username, password, qq, captchaKey, captchaAnswer } = await c.req.json();

  // A. 校验验证码
  const realAnswer = await c.env.KV.get(captchaKey);
  if (!realAnswer || realAnswer !== captchaAnswer.toString()) {
    return c.json({ success: false, message: '验证码错误或已过期' }, 400);
  }
  // 验证通过后删除缓存，防重放
  await c.env.KV.delete(captchaKey);

  // B. 校验QQ号 (必须是数字)
  if (!/^\d{5,12}$/.test(qq)) {
    return c.json({ success: false, message: '请输入真实的QQ号' }, 400);
  }

  try {
    // C. 检查用户名是否已存在
    const exist = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
    if (exist) {
      return c.json({ success: false, message: '该账号已被注册' }, 400);
    }

    // D. 自动判断是否为第一个用户 (如果是，设为管理员)
    const userCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
    const role = (userCount.count === 0) ? 'admin' : 'user';
    const vipLevel = (role === 'admin') ? 2 : 0; // 管理员默认 SVIP(2)

    // E. 密码加密并入库
    const passwordHash = await hashPassword(password);
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';

    const result = await c.env.DB.prepare(
      'INSERT INTO users (username, password_hash, qq_number, role, vip_level, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(username, passwordHash, qq, role, vipLevel, ip).run();

    return c.json({ success: true, message: '注册成功！请登录', role: role });

  } catch (e) {
    return c.json({ success: false, message: '注册失败: ' + e.message }, 500);
  }
});

// --- 3. 登录接口 (POST /api/auth/login) ---
auth.post('/login', async (c) => {
  const { username, password, captchaKey, captchaAnswer } = await c.req.json();

  // A. 校验验证码 (登录也需要验证码)
  const realAnswer = await c.env.KV.get(captchaKey);
  if (!realAnswer || realAnswer !== captchaAnswer.toString()) {
    return c.json({ success: false, message: '验证码错误' }, 400);
  }
  await c.env.KV.delete(captchaKey);

  try {
    // B. 查找用户
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
    
    if (!user) {
      return c.json({ success: false, message: '账号不存在' }, 404);
    }

    // C. 小黑屋检测
    if (user.is_banned === 1) {
      return c.json({ success: false, message: '该账号已被封禁 (小黑屋)，无法登录' }, 403);
    }

    // D. 校验密码
    const inputHash = await hashPassword(password);
    if (inputHash !== user.password_hash) {
      return c.json({ success: false, message: '密码错误' }, 401);
    }

    // E. 签发 JWT Token
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7天过期
    };
    const token = await sign(payload, c.env.JWT_SECRET);

    // F. 返回用户信息 (包含QQ头像链接)
    const avatarUrl = `http://q.qlogo.cn/headimg_dl?dst_uin=${user.qq_number}&spec=100`;

    return c.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        vip_level: user.vip_level,
        avatar: avatarUrl
      }
    });

  } catch (e) {
    return c.json({ success: false, message: '登录异常: ' + e.message }, 500);
  }
});

export default auth;
