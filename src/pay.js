/**
* 优米博客 - 专注网络优质资源分享！
* @永久网址 [WWW.UMI88.CC]
* @联系扣扣 [主446099815][副228522198]
* @ 加群交流[唯一官方QQ群:13936509]
* @todo [本程序通过cloudflare加workers加D1数据库加KV空间即可启动]
*/

import { Hono } from 'hono';

const pay = new Hono();

// --- 辅助函数：生成自定义订单号 (umi + 年月日 + 随机数) ---
function generateOrderNo() {
  const date = new Date();
  const ymd = date.toISOString().slice(0,10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `umi${ymd}${random}`;
}

// --- 1. 创建订单接口 (前端点击购买时调用) ---
// 需要 Header 中包含 Authorization: Bearer <token>
pay.post('/create', async (c) => {
  try {
    // 获取用户信息 (依赖 worker.js 中的 JWT 中间件注入)
    const payload = c.get('jwtPayload'); 
    if (!payload) {
        // 如果中间件没生效，尝试手动解码或者返回错误
        return c.json({ error: '请先登录' }, 401);
    }
    const userId = payload.sub; // 用户ID

    const { type, itemId } = await c.req.json(); 
    // type: 'vip_month'(包月), 'vip_year'(包年), 'post'(单篇)
    
    let amount = 0.00;
    let orderType = '';
    let relatedId = 0;

    // A. 计价逻辑 (建议后期放入数据库配置表)
    if (type === 'vip_month') {
        amount = 10.00; 
        orderType = 'vip';
        relatedId = 30; // 30天
    } else if (type === 'vip_year') {
        amount = 100.00;
        orderType = 'vip';
        relatedId = 365; // 365天
    } else if (type === 'post') {
        // 查询文章价格
        const post = await c.env.DB.prepare('SELECT price FROM posts WHERE id = ?').bind(itemId).first();
        if (!post || post.price <= 0) return c.json({ error: '该文章免费或不存在' }, 400);
        amount = post.price;
        orderType = 'post';
        relatedId = itemId;
    } else {
        return c.json({ error: '无效的购买类型' }, 400);
    }

    // B. 创建本地订单
    const orderNo = generateOrderNo();
    await c.env.DB.prepare(
        'INSERT INTO orders (order_no, user_id, order_type, related_id, amount, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(orderNo, userId, orderType, relatedId, amount, 'pending').run();

    // C. 对接支付宝当面付 (简化版)
    // 真实环境需使用 ALIPAY_APP_ID 和 ALIPAY_PRIVATE_KEY 进行 RSA 签名
    // 这里生成一个模拟链接用于演示流程
    const qrCode = `https://qr.alipay.com/baxxxxxxx?order=${orderNo}`; 

    return c.json({
        success: true,
        orderNo: orderNo,
        amount: amount,
        payUrl: qrCode, // 前端生成二维码
        message: '订单创建成功，请扫码支付'
    });

  } catch (e) {
    return c.json({ success: false, message: '创建订单失败: ' + e.message }, 500);
  }
});

// --- 2. 支付宝异步回调接口 (核心：自动发货) ---
// 支付宝服务器会 POST 这个地址
pay.post('/notify', async (c) => {
  try {
    const formData = await c.req.parseBody();
    const orderNo = formData['out_trade_no']; // 商户订单号
    const tradeStatus = formData['trade_status']; // 交易状态
    const totalAmount = formData['total_amount']; // 金额
    const alipayTradeNo = formData['trade_no']; // 支付宝流水号

    // A. 验签逻辑 (生产环境必须校验支付宝公钥)
    // const isSignValid = verifySignature(formData, c.env.ALIPAY_PUBLIC_KEY);
    const isSignValid = true; // 暂时跳过验签

    if (isSignValid && (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED')) {
        
        // B. 查询订单
        const order = await c.env.DB.prepare('SELECT * FROM orders WHERE order_no = ?').bind(orderNo).first();
        
        if (order && order.status === 'pending') {
            // C. 标记已支付
            await c.env.DB.prepare('UPDATE orders SET status = ?, alipay_trade_no = ?, updated_at = ? WHERE id = ?')
                .bind('paid', alipayTradeNo, Date.now(), order.id).run();

            // D. 自动发货
            if (order.order_type === 'vip') {
                // 处理会员时长
                const days = order.related_id;
                const seconds = days * 24 * 60 * 60;
                
                // 查用户当前过期时间
                const user = await c.env.DB.prepare('SELECT vip_expire_time, vip_level FROM users WHERE id = ?').bind(order.user_id).first();
                
                // 如果本来没过期，就从过期时间加；如果过期了，就从现在加
                const currentExpire = user.vip_expire_time || 0;
                const baseTime = (currentExpire > (Date.now() / 1000)) ? currentExpire : (Date.now() / 1000);
                const newExpire = Math.floor(baseTime + seconds);
                
                // 更新用户 VIP 状态 (等级至少提升为1)
                await c.env.DB.prepare('UPDATE users SET vip_expire_time = ?, vip_level = MAX(vip_level, 1) WHERE id = ?')
                    .bind(newExpire, order.user_id).run();
            
            } else if (order.order_type === 'post') {
                // 单篇购买，仅需更改订单状态，用户访问文章时检查 orders 表即可
            }
        }
        return c.text('success'); 
    }

    return c.text('fail');

  } catch (e) {
    console.error('Notify Error:', e);
    return c.text('fail');
  }
});

// --- 3. 订单状态检查 (前端轮询) ---
pay.get('/check/:orderNo', async (c) => {
    const orderNo = c.req.param('orderNo');
    const order = await c.env.DB.prepare('SELECT status FROM orders WHERE order_no = ?').bind(orderNo).first();
    return c.json({ 
        success: true,
        paid: order && order.status === 'paid' 
    });
});

export default pay;
