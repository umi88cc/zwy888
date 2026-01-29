/**
* 优米博客 - 前端逻辑
* @功能 弹窗 / 验证码 / 登录注册
*/

const API_BASE = 'https://umi88.cc/api'; // 你的域名

// 1. 弹窗控制
const userBtn = document.getElementById('userBtn');
const modal = document.getElementById('authModal');

userBtn.addEventListener('click', () => {
    // 检查是否已登录 (本地LocalStore)
    const token = localStorage.getItem('umi_token');
    if(token) {
        alert('您已登录！(后续跳转个人中心)');
    } else {
        modal.style.display = 'flex';
        loadCaptcha('login'); // 打开时加载验证码
    }
});

function closeModal() {
    modal.style.display = 'none';
}

function switchTab(tab) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.tab-header span').forEach(s => s.classList.remove('active'));
    
    document.getElementById(tab + 'Form').classList.add('active');
    // 简单的Tab样式切换逻辑
    const index = tab === 'login' ? 0 : 1;
    document.querySelectorAll('.tab-header span')[index].classList.add('active');
    
    loadCaptcha(tab); // 切换时刷新验证码
}

// 2. 加载验证码 (调用 worker 后端)
async function loadCaptcha(type) {
    const labelId = type === 'login' ? 'loginCaptchaQuestion' : 'regCaptchaQuestion';
    const keyId = type === 'login' ? 'loginCaptchaKey' : 'regCaptchaKey';
    
    document.getElementById(labelId).innerText = '计算中...';
    
    try {
        const res = await fetch(`${API_BASE}/auth/captcha`);
        const data = await res.json();
        
        if(data.success) {
            document.getElementById(labelId).innerText = data.question; // 显示 15+2=?
            document.getElementById(keyId).value = data.key; // 存Key
        }
    } catch (e) {
        console.error('API未通:', e);
        document.getElementById(labelId).innerText = '离线模式'; // 方便调试
    }
}

// 3. 注册逻辑
document.getElementById('registerForm').addEventListener('submit', async (e) => {
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
        if(data.success) switchTab('login'); // 注册成功跳到登录
    } catch (e) {
        alert('注册请求失败，请检查网络');
    }
});

// 4. 登录逻辑
document.getElementById('loginForm').addEventListener('submit', async (e) => {
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
            alert('登录成功！欢迎 ' + data.user.username);
            localStorage.setItem('umi_token', data.token); // 保存Token
            localStorage.setItem('umi_user', JSON.stringify(data.user));
            closeModal();
            // TODO: 刷新页面或更新右上角头像
        } else {
            alert(data.message);
            loadCaptcha('login'); // 失败后刷新验证码
        }
    } catch (e) {
        alert('登录失败');
    }
});
