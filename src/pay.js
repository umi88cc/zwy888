/**
* 优米博客 - 支付核心模块
* @功能 [创建订单 | 支付宝对接 | 回调处理 | 自动发货]
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
pay.post('/create', async (c) => {
  try {
    const user = c.get('user'); // 从 JWT 中间件获取用户信息(需要在 worker.js 挂载时加中间件)
    if (!user) return c.json({ error: '请先登录' }, 401);

    const { type, itemId } = await c.req.json(); 
    // type: 'vip_month'(包月), 'vip_year'(包年), 'post'(单篇)
    // itemId: 如果是文章购买，这里传文章ID

    let amount = 0.00;
    let orderType = '';
    let relatedId = 0;

    // A. 计价逻辑 (实际价格应从数据库或KV配置读取，这里先写死示例)
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
    ).bind(orderNo, user.id, orderType, relatedId, amount, 'pending').run();

    // C. 对接支付宝当面付 (简化逻辑)
    // 真实环境需要用 ALIPAY_PRIVATE_KEY 对参数进行 RSA 签名
    // 这里返回一个模拟的支付链接或二维码内容
    
    // 假设这是支付宝返回的二维码链接 (实际开发需引入 crypto 库进行签名调用 alipay.trade.precreate)
    const qrCode = `https://qr.alipay.com/baxxxxxxx?order=${orderNo}`; 

    return c.json({
        success: true,
        orderNo: orderNo,
        amount: amount,
        payUrl: qrCode, // 前端拿到这个生成二维码给用户扫
        message: '订单创建成功，请扫码支付'
    });

  } catch (e) {
    return c.json({ success: false, message: '创建订单失败: ' + e.message }, 500);
  }
});

// --- 2. 支付宝异步回调接口 (核心：发货逻辑) ---
// 支付宝服务器会 POST 这个地址通知我们用户付钱了
pay.post('/notify', async (c) => {
  try {
    const formData = await c.req.parseBody();
    const orderNo = formData['out_trade_no']; // 我们生成的订单号
    const tradeStatus = formData['trade_status']; // 交易状态
    const totalAmount = formData['total_amount']; // 支付金额

    // A. 验签 (为了安全，必须验证这是支付宝发的，不是黑客伪造的)
    // TODO: 这里需要使用 ALIPAY_PUBLIC_KEY 进行验签。
    // 为演示逻辑，暂时假设验签通过。
    const verifySuccess = true; 

    if (verifySuccess && (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED')) {
        
        // B. 查询订单信息
        const order = await c.env.DB.prepare('SELECT * FROM orders WHERE order_no = ?').bind(orderNo).first();
        
        if (order && order.status === 'pending') {
            // C. 标记订单为已支付
            await c.env.DB.prepare('UPDATE orders SET status = ?, alipay_trade_no = ?, updated_at = ? WHERE id = ?')
                .bind('paid', formData['trade_no'], Date.now(), order.id).run();

            // D. 核心发货逻辑 (自动开通)
            if (order.order_type === 'vip') {
                // 给用户加时长
                const days = order.related_id;
                const seconds = days * 24 * 60 * 60;
                
                // 查用户当前过期时间
                const user = await c.env.DB.prepare('SELECT vip_expire_time, vip_level FROM users WHERE id = ?').bind(order.user_id).first();
                let newExpire = Math.max(Date.now() / 1000, user.vip_expire_time || 0) + seconds;
                
                // 更新用户 VIP 状态
                await c.env.DB.prepare('UPDATE users SET vip_expire_time = ?, vip_level = MAX(vip_level, 1) WHERE id = ?')
                    .bind(newExpire, order.user_id).run();
            
            } else if (order.order_type === 'post') {
                // 单篇购买，不需要改用户信息，前端查询时检查 orders 表即可
            }
        }
        return c.text('success'); // 告诉支付宝我们收到了
    }

    return c.text('fail');

  } catch (e) {
    console.error('Callback Error', e);
    return c.text('fail');
  }
});

// --- 3. 前端轮询接口 (检查订单状态) ---
// 用户扫码后，前端每秒调用一次，看是否支付成功
pay.get('/check/:orderNo', async (c) => {
    const orderNo = c.req.param('orderNo');
    const order = await c.env.DB.prepare('SELECT status FROM orders WHERE order_no = ?').bind(orderNo).first();
    return c.json({ 
        paid: order && order.status === 'paid' 
    });
});

export default pay;
