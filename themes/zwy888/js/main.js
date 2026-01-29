/**
* 优米博客 - 专注网络优质资源分享！
* @永久网址 [WWW.UMI88.CC]
* @联系扣扣 [主446099815][副228522198]
* @ 加群交流[唯一官方QQ群:13936509]
* @todo [前端核心逻辑 - 含个人中心与管理员入口]
*/

const API_BASE = 'https://umi88.cc/api'; // 替换为你的真实域名

// --- 全局变量 ---
let pollTimer = null; // 轮询定时器

// --- 1. 弹窗与个人中心逻辑 ---
const userBtn = document.getElementById('userBtn');
const authModal = document.getElementById('authModal');
const payModal = document.getElementById('payModal'); 

// 点击右上角头像
if(userBtn) {
    userBtn.addEventListener('click', () => {
        const token = localStorage.getItem('umi_token');
        const userStr = localStorage.getItem('umi_user');
        
        if(token && userStr) {
            // 已登录 -> 显示个人中心 (复用 Auth 弹窗容器)
            showUserCenter(JSON.parse(userStr));
        } else {
            // 未登录 -> 显示登录框
            openModal('auth');
        }
    });
}

// 动态渲染个人中心 (隐形后台入口在这里)
function showUserCenter(user) {
    const modal = document.getElementById('authModal');
    const card = modal.querySelector('.modal-card');
    
    // 备份原始 HTML (用于注销后恢复登录界面)
    if(!window.authHtmlBackup) window.authHtmlBackup = card.innerHTML;
    
    // 判断是否为管理员
    const adminBtnHtml = (user.role === 'admin') 
        ? `<a href="/admin.html" class="submit-btn" style="display:block; text-align:center; background:#333; margin-top:10px; text-decoration:none;">
             <i class="fa-solid fa-gear"></i> 进入后台管理
           </a>` 
        : '';

    // 动态生成个人中心界面
    card.innerHTML = `
        <button class="close-btn" onclick="closeModal('authModal')">×</button>
        <div style="text-align:center; padding:10px;">
            <img src="${user.avatar}" style="width:80px; height:80px; border-radius:50%; margin-bottom:10px; border:3px solid #eee;">
            <h3 style="margin-bottom:5px;">${user.username}</h3>
            <p style="color:#999; font-size:12px; margin-bottom:20px;">
                身份: <span style="color:${user.vip_level > 0 ? 'red' : '#666'}">
                ${getVipName(user.vip_level)}
                </span>
            </p>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
                <button class="submit-btn" style="background:#feca57;" onclick="alert('开发中...')">我的订单</button>
                <button class="submit-btn" style="background:#54a0ff;" onclick="alert('请联系站长充值')">开通会员</button>
            </div>
            
            ${adminBtnHtml} <button onclick="logout()" style="width:100%; padding:10px; margin-top:15px; background:none; border:1px solid #ddd; border-radius:8px; cursor:pointer; color:#666;">
                退出登录
            </button>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function getVipName(level) {
    if(level === 2) return 'SVIP 至尊会员';
    if(level === 1) return 'VIP 会员';
    return '普通用户';
}

function logout() {
    if(confirm('确定要退出吗？')) {
        localStorage.removeItem('umi_token');
        localStorage.removeItem('umi_user');
        
        // 恢复登录界面的 HTML
        const modal = document.getElementById('authModal');
        if(window.authHtmlBackup) {
            modal.querySelector('.modal-card').innerHTML = window.authHtmlBackup;
            // 重新绑定事件监听器可能比较麻烦，直接刷新页面最简单
        }
        location.reload();
    }
}

// --- 通用弹窗控制 ---
function openModal(type) {
    if(type === 'auth') {
        // 如果之前被替换成了个人中心，先恢复
        if(window.authHtmlBackup) {
            document.querySelector('#authModal .modal-card').innerHTML = window.authHtmlBackup;
        }
        authModal.style.display = 'flex';
        // 重新绑定一下 Tab 切换事件 (防止 innerHTML 替换后失效)
        bindAuthEvents();
        loadCaptcha('login');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    if(modalId === 'payModal') {
        clearInterval(pollTimer); // 关闭支付窗时停止轮询
    }
}

// 绑定关闭按钮事件 (使用事件委托，适应动态生成的元素)
document.addEventListener('click', (e) => {
    if(e.target.classList.contains('close-btn')) {
        const modal = e.target.closest('.modal-overlay');
        if(modal) closeModal(modal.id);
    }
    // 点击遮罩层关闭
    if(e.target.classList.contains('modal-overlay')) {
        closeModal(e.target.id);
    }
});

// --- 2. 验证码与鉴权逻辑 ---

// 重新绑定登录/注册表单事件 (用于 HTML 恢复后)
function bindAuthEvents() {
    document.querySelectorAll('.tab-header span').forEach(span => {
        span.onclick = function() {
             const tab = this.innerText === '登录' ? 'login' : 'register';
             switchTab(tab);
        }
    });

    const loginForm = document.getElementById('loginForm');
    if(loginForm) loginForm.onsubmit = handleLogin;

    const regForm = document.getElementById('registerForm');
    if(regForm) regForm.onsubmit = handleRegister;
}

function switchTab(tab) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.tab-header span').forEach(s => s.classList.remove('active'));
    
    document.getElementById(tab + 'Form').classList.add('active');
    const index = tab === 'login' ? 0 : 1;
    document.querySelectorAll('.tab-header span')[index].classList.add('active');
    
    loadCaptcha(tab);
}

async function loadCaptcha(type) {
    const labelId = type === 'login' ? 'loginCaptchaQuestion' : 'regCaptchaQuestion';
    const keyId = type === 'login' ? 'loginCaptchaKey' : 'regCaptchaKey';
    
    const label = document.getElementById(labelId);
    if(!label) return;

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

// 注册处理
async function handleRegister(e) {
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
}

// 登录处理
async function handleLogin(e) {
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
            location.reload(); 
        } else {
            alert(data.message);
            loadCaptcha('login');
        }
    } catch (e) {
        alert('登录失败');
    }
}

// 页面加载时初始化绑定
bindAuthEvents();


// --- 3. 支付核心逻辑 ---

// 发起订单 (被 post.html 调用)
async function createOrder(type, itemId) {
    const token = localStorage.getItem('umi_token');
    if(!token) {
        alert('请先登录后再购买！');
        openModal('auth');
        return;
    }

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
            document.getElementById('payAmount').innerText = `¥${data.amount}`;
            
            // 生成二维码 (使用第三方API)
            const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.payUrl)}`;
            document.getElementById('payQrCode').innerHTML = `<img src="${qrApi}" alt="扫码支付">`;
            
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
                location.reload();
            }
        } catch (e) {
            console.log('Poll error', e);
        }
    }, 2000);
}

// 暴露全局方法
window.createOrder = createOrder;
window.closeModal = closeModal;
window.switchTab = switchTab;
window.logout = logout;
