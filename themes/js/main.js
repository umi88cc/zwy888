/**
* 优米博客 - 核心逻辑 (含智能分页与列表渲染)
*/
const API_BASE = 'https://umi88.cc/api'; 
let pollTimer = null; 

// --- 分页配置 ---
// 手机端显示 15 条，电脑端显示 25 条
const ITEMS_PER_PAGE = window.innerWidth <= 768 ? 15 : 25;
let currentPage = 1;

// --- 1. 初始化逻辑 ---
document.addEventListener('DOMContentLoaded', () => {
    // 如果存在 postContainer，说明是首页，加载文章列表
    if(document.getElementById('articleList')) {
        loadPosts(1);
    }
    
    // 绑定弹窗事件 (登录/支付)
    bindGlobalEvents();
});

// --- 2. 文章加载与渲染 ---
async function loadPosts(page) {
    const container = document.getElementById('articleList');
    if(!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px;">加载中...</div>';
    currentPage = page;

    try {
        const res = await fetch(`${API_BASE}/posts/list?page=${page}&limit=${ITEMS_PER_PAGE}`);
        const json = await res.json();
        
        if(json.success && json.data.length > 0) {
            // 渲染文章列表
            container.innerHTML = json.data.map(post => `
                <a href="/tech/${post.id}.html" class="post-card">
                    <div class="post-thumb">
                        <img src="${post.thumbnail_url || 'https://via.placeholder.com/300x200?text=No+Image'}" loading="lazy" alt="${post.title}">
                        ${post.view_permission > 0 ? '<span class="post-tag">VIP</span>' : ''}
                    </div>
                    <div class="post-content">
                        <div>
                            <h3 class="post-title">${post.title}</h3>
                            <p class="post-excerpt">${post.excerpt}</p>
                        </div>
                        <div class="post-meta">
                            <span><i class="fa-regular fa-clock"></i> ${new Date(post.created_at * 1000).toISOString().slice(0,10)}</span>
                            <span><i class="fa-regular fa-eye"></i> 浏览</span>
                            ${post.price > 0 ? `<span style="color:#ff6b6b">¥${post.price}</span>` : ''}
                        </div>
                    </div>
                </a>
            `).join('');
            
            // 渲染分页按钮
            renderPagination(json.page, json.totalPages);
            
            // 回到顶部
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">暂无文章</div>';
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div style="text-align:center; color:red;">加载失败，请刷新重试</div>';
    }
}

function renderPagination(current, total) {
    const pag = document.getElementById('pagination');
    if(!pag) return;
    
    if(total <= 1) {
        pag.innerHTML = '';
        return;
    }

    let html = '';
    // 上一页
    if(current > 1) {
        html += `<button class="page-btn" onclick="loadPosts(${current - 1})">上一页</button>`;
    }
    
    // 显示页码 (简单版: 显示当前页)
    html += `<span style="padding:8px 12px; color:#999;">第 ${current} / ${total} 页</span>`;
    
    // 下一页
    if(current < total) {
        html += `<button class="page-btn" onclick="loadPosts(${current + 1})">下一页</button>`;
    }
    
    pag.innerHTML = html;
}
// 将 loadPosts 暴露给全局以便 onclick 调用
window.loadPosts = loadPosts;


// --- 3. 弹窗与鉴权逻辑 (保持原有功能不变) ---
const userBtn = document.getElementById('userBtn');
const authModal = document.getElementById('authModal');
const payModal = document.getElementById('payModal'); 

function bindGlobalEvents() {
    if(userBtn) {
        userBtn.addEventListener('click', () => {
            const token = localStorage.getItem('umi_token');
            const userStr = localStorage.getItem('umi_user');
            if(token && userStr) {
                showUserCenter(JSON.parse(userStr));
            } else {
                openModal('auth');
            }
        });
    }
    // 绑定关闭按钮
    document.addEventListener('click', (e) => {
        if(e.target.classList.contains('close-btn') || e.target.classList.contains('modal-overlay')) {
            const modal = e.target.closest('.modal-overlay');
            if(modal) closeModal(modal.id);
        }
    });
}

function showUserCenter(user) {
    const modal = document.getElementById('authModal');
    const card = modal.querySelector('.modal-card');
    if(!window.authHtmlBackup) window.authHtmlBackup = card.innerHTML;
    
    const adminBtnHtml = (user.role === 'admin') 
        ? `<a href="/admin.html" class="submit-btn" style="display:block; text-align:center; background:#333; margin-top:10px; text-decoration:none;"><i class="fa-solid fa-gear"></i> 进入后台管理</a>` : '';

    card.innerHTML = `
        <button class="close-btn" onclick="closeModal('authModal')">×</button>
        <div style="text-align:center; padding:10px;">
            <img src="${user.avatar}" style="width:80px; height:80px; border-radius:50%; margin-bottom:10px; border:3px solid #eee;">
            <h3 style="margin-bottom:5px;">${user.username}</h3>
            <p style="color:#999; font-size:12px; margin-bottom:20px;">身份: ${user.vip_level > 0 ? 'VIP会员' : '普通用户'}</p>
            <button onclick="logout()" style="width:100%; padding:10px; margin-top:15px; background:none; border:1px solid #ddd; border-radius:8px; cursor:pointer;">退出登录</button>
            ${adminBtnHtml}
        </div>
    `;
    modal.style.display = 'flex';
}

function logout() {
    if(confirm('确定退出？')) {
        localStorage.removeItem('umi_token'); localStorage.removeItem('umi_user');
        const modal = document.getElementById('authModal');
        if(window.authHtmlBackup) modal.querySelector('.modal-card').innerHTML = window.authHtmlBackup;
        location.reload();
    }
}

function openModal(type) {
    if(type === 'auth') {
        if(window.authHtmlBackup) document.querySelector('#authModal .modal-card').innerHTML = window.authHtmlBackup;
        authModal.style.display = 'flex';
        bindAuthEventsInternal();
        loadCaptcha('login');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    if(modalId === 'payModal') clearInterval(pollTimer);
}

function bindAuthEventsInternal() {
    document.querySelectorAll('.tab-header span').forEach(span => {
        span.onclick = function() { switchTab(this.innerText === '登录' ? 'login' : 'register'); }
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
        if(data.success) { label.innerText = data.question; document.getElementById(keyId).value = data.key; }
    } catch (e) { label.innerText = 'API错误'; }
}

async function handleLogin(e) {
    e.preventDefault();
    const json = Object.fromEntries(new FormData(e.target).entries());
    const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', body: JSON.stringify(json) });
    const data = await res.json();
    if(data.success) {
        localStorage.setItem('umi_token', data.token); localStorage.setItem('umi_user', JSON.stringify(data.user));
        closeModal('authModal'); location.reload();
    } else { alert(data.message); loadCaptcha('login'); }
}

async function handleRegister(e) {
    e.preventDefault();
    const json = Object.fromEntries(new FormData(e.target).entries());
    const res = await fetch(`${API_BASE}/auth/register`, { method: 'POST', body: JSON.stringify(json) });
    const data = await res.json();
    alert(data.message);
    if(data.success) switchTab('login'); else loadCaptcha('register');
}

// 暴露全局
window.createOrder = async function(type, itemId) { /* 略，保持原支付逻辑 */ };
window.closeModal = closeModal;
window.switchTab = switchTab;
window.logout = logout;
