const API_BASE = '/api';

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    updateUserInterface();
    bindAuthEvents();
});

// 1. 用户界面状态 (头像 + 后台入口)
function updateUserInterface() {
    const userStr = localStorage.getItem('umi_user');
    const userBtn = document.getElementById('userBtn');
    if (!userStr || !userBtn) return;

    try {
        const user = JSON.parse(userStr);
        let html = '';
        // 显示头像
        if (user.avatar) {
            html += `<img src="${user.avatar}" style="width:36px; height:36px; border-radius:50%; border:2px solid #fff; box-shadow:0 2px 5px rgba(0,0,0,0.1);" onclick="toggleUserMenu()">`;
        }
        
        // 挂载一个下拉菜单 (只有管理员能看到后台入口)
        html += `
        <div id="userMenu" style="display:none; position:absolute; top:50px; right:20px; background:#fff; padding:10px; border-radius:8px; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
            <div style="font-weight:bold; margin-bottom:5px;">${user.username}</div>
            ${user.role === 'admin' ? '<a href="/admin" style="display:block; color:red; margin-bottom:5px;">进入后台管理</a>' : ''}
            <div onclick="logout()" style="color:#666; cursor:pointer;">退出登录</div>
        </div>`;
        
        userBtn.innerHTML = html;
        userBtn.onclick = null; // 移除默认点击打开弹窗
    } catch (e) {}
}

window.toggleUserMenu = function() {
    const menu = document.getElementById('userMenu');
    if(menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// 2. 绑定事件
function bindAuthEvents() {
    const userBtn = document.getElementById('userBtn');
    // 如果没登录，点击打开弹窗
    if (userBtn && !localStorage.getItem('umi_token')) {
        userBtn.onclick = () => openModal('authModal');
    }
    
    // 验证码加载
    if(document.getElementById('loginCaptchaQuestion')) loadCaptcha('login');
    
    // 绑定表单提交
    const loginForm = document.getElementById('loginForm');
    if(loginForm) loginForm.onsubmit = handleLogin;
    
    const regForm = document.getElementById('registerForm');
    if(regForm) regForm.onsubmit = handleRegister;
}

// 3. 核心功能
window.openModal = (id) => {
    document.getElementById(id).style.display = 'flex';
    if(id === 'authModal') loadCaptcha('login');
}
window.closeModal = (id) => document.getElementById(id).style.display = 'none';

window.switchTab = (tab) => {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.tab-header span').forEach(s => s.classList.remove('active'));
    document.getElementById(tab + 'Form').classList.add('active');
    const idx = tab === 'login' ? 0 : 1;
    document.querySelectorAll('.tab-header span')[idx].classList.add('active');
    loadCaptcha(tab);
}

window.logout = () => {
    if(confirm('确认退出？')) {
        localStorage.removeItem('umi_token');
        localStorage.removeItem('umi_user');
        location.reload();
    }
}

async function loadCaptcha(type) {
    // ... (复制之前的验证码逻辑) ...
    // 为了节省篇幅，这里简写，请务必把之前的 fetch captcha 逻辑放进来
    try{
        const res = await fetch(`${API_BASE}/auth/captcha`);
        const d = await res.json();
        const prefix = type === 'login' ? 'login' : 'reg';
        if(d.success) {
            document.getElementById(prefix+'CaptchaQuestion').innerText = d.question;
            document.getElementById(prefix+'CaptchaKey').value = d.key;
        }
    }catch(e){}
}

async function handleLogin(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {method:'POST', body:JSON.stringify(data)});
        const json = await res.json();
        if(json.success) {
            localStorage.setItem('umi_token', json.token);
            localStorage.setItem('umi_user', JSON.stringify(json.user));
            closeModal('authModal');
            location.reload();
        } else {
            alert(json.message); loadCaptcha('login');
        }
    } catch(err) { alert('登录请求失败'); }
}

async function handleRegister(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
        const res = await fetch(`${API_BASE}/auth/register`, {method:'POST', body:JSON.stringify(data)});
        const json = await res.json();
        if(json.success) {
            localStorage.setItem('umi_token', json.token);
            localStorage.setItem('umi_user', JSON.stringify(json.user));
            alert(json.message); closeModal('authModal');
            location.reload();
        } else {
            alert(json.message); loadCaptcha('register');
        }
    } catch(err) { alert('注册请求失败'); }
}
