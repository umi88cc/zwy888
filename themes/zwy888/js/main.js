/**
* 优米博客 - 专注网络优质资源分享！
* @永久网址 [WWW.UMI88.CC]
* @联系扣扣 [主446099815][副228522198]
* @ 加群交流[唯一官方QQ群:13936509]
* @todo [本程序通过cloudflare加workers加D1数据库加KV空间即可启动]
*/

const API_BASE = 'https://umi88.cc/api'; // 替换为你的真实域名

// --- 全局变量 ---
let pollTimer = null; // 轮询定时器

// --- 1. 弹窗控制逻辑 ---
const userBtn = document.getElementById('userBtn');
const authModal = document.getElementById('authModal');
const payModal = document.getElementById('payModal'); // 支付弹窗(需在HTML添加)

// 点击头像：如果已登录跳转个人中心(暂未做)，未登录弹窗
if(userBtn) {
    userBtn.addEventListener('click', () => {
        const token = localStorage.getItem('umi_token');
        if(token) {
            // TODO: 跳转到个人中心页面
            alert('您已登录！(个人中心开发中...)');
        } else {
            openModal('auth');
        }
    });
}

function openModal(type) {
    if(type === 'auth') {
        authModal.style.display = 'flex';
        loadCaptcha('login');
    } else if(type === 'pay') {
        // 支付弹窗逻辑由 createOrder 触发，这里不单独处理
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    if(modalId === 'payModal') {
        clearInterval(pollTimer); // 关闭支付窗时停止轮询
    }
}

// 绑定关闭按钮事件
document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        closeModal(modal.id);
    });
});

// 切换登录/注册 Tab
function switchTab(tab) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.tab-header span').forEach(s => s.classList.remove('active'));
    
    document.getElementById(tab + 'Form').classList.add('active');
    const index = tab === 'login' ? 0 : 1;
    document.querySelectorAll('.tab-header span')[index].classList.add('active');
    
    loadCaptcha(tab);
}

// --- 2. 验证码与鉴权逻辑 ---

async function loadCaptcha(type) {
    const labelId = type === 'login' ? 'loginCaptchaQuestion' : 'regCaptchaQuestion';
    const keyId = type === 'login' ? 'loginCaptchaKey' : 'regCaptchaKey';
    
    const label = document.getElementById(labelId);
    if(!label) return; // 防止页面没元素报错

    label.innerText = '计算中...';
    try {
        const res = await fetch(`${API_BASE}/auth/captcha`);
        const data = await res.json();
        if(data.success) {
            label.innerText = data.question;
            document.getElementById(keyId).value = data.key;
        }
    } catch (e) {
        label.innerText = 'API错误';
    }
}

// 注册提交
const regForm = document.getElementById('registerForm');
if(regForm) {
    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const json = Object.fromEntries(formData.entries());
        
        try {
            const res = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                body: JSON.stringify(json)
            });
            const data = await res.json();
            alert(data.message);
            if(data.success) switchTab('login');
        } catch (e) {
            alert('注册请求失败');
        }
    });
}

// 登录提交
const loginForm = document.getElementById('loginForm');
if(loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const json = Object.fromEntries(formData.entries());
        
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                body: JSON.stringify(json)
            });
            const data = await res.json();
            
            if(data.success) {
                alert('登录成功！');
                localStorage.setItem('umi_token', data.token);
                localStorage.setItem('umi_user', JSON.stringify(data.user));
                closeModal('authModal');
                location.reload(); // 刷新页面以更新状态
            } else {
                alert(data.message);
                loadCaptcha('login');
            }
        } catch (e) {
            alert('登录失败');
        }
    });
}

// --- 3. 支付核心逻辑 ---

// 发起订单 (被 post.html 调用)
async function createOrder(type, itemId) {
    const token = localStorage.getItem('umi_token');
    if(!token) {
        alert('请先登录后再购买！');
        openModal('auth');
        return;
    }

    // 显示支付弹窗 Loading
    const payModal = document.getElementById('payModal');
    if(!payModal) return alert('缺少支付弹窗组件');
    
    payModal.style.display = 'flex';
    document.getElementById('payQrCode').innerHTML = '正在创建订单...';
    document.getElementById('payAmount').innerText = '...';

    try {
        const res = await fetch(`${API_BASE}/pay/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ type, itemId })
        });
        const data = await res.json();

        if(data.success) {
            // 显示金额
            document.getElementById('payAmount').innerText = `¥${data.amount}`;
            
            // 生成二维码 (这里用第三方API将支付宝链接转为二维码图片)
            // data.payUrl 是支付宝的支付链接
            const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.payUrl)}`;
            document.getElementById('payQrCode').innerHTML = `<img src="${qrApi}" alt="扫码支付">`;
            
            // 开始轮询订单状态
            startPolling(data.orderNo);
        } else {
            alert(data.message || '订单创建失败');
            closeModal('payModal');
        }

    } catch (e) {
        console.error(e);
        alert('系统错误');
        closeModal('payModal');
    }
}

// 轮询查单
function startPolling(orderNo) {
    if(pollTimer) clearInterval(pollTimer);
    
    pollTimer = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/pay/check/${orderNo}`);
            const data = await res.json();
            
            if(data.paid) {
                clearInterval(pollTimer);
                alert('支付成功！即将解锁内容...');
                location.reload(); // 刷新页面，后端会重新渲染解锁后的内容
            }
        } catch (e) {
            console.log('Poll error', e);
        }
    }, 2000); // 每2秒查一次
}

// 暴露给 HTML 调用
window.createOrder = createOrder;
window.closeModal = closeModal;
window.switchTab = switchTab;
