/**
* 优米博客 - 核心逻辑 (无Loading版)
*/
const API_BASE = 'https://umi88.cc/api'; 
let pollTimer = null; 
const ITEMS_PER_PAGE = window.innerWidth <= 768 ? 15 : 25;

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('articleList')) {
        loadPosts(1);
    }
    bindGlobalEvents();
});

// --- 文章加载 (去除Loading动画) ---
async function loadPosts(page) {
    const container = document.getElementById('articleList');
    if(!container) return;
    
    // 【修改点】: 这一行被删除了，不再显示“正在加载...”
    // container.innerHTML = '...'; 

    try {
        // 加时间戳防止缓存
        const res = await fetch(`${API_BASE}/posts/list?page=${page}&limit=${ITEMS_PER_PAGE}&t=${Date.now()}`);
        const json = await res.json();

        if(json.success && json.data && json.data.length > 0) {
            container.innerHTML = json.data.map(post => `
                <a href="/tech/${post.id}.html" class="post-card">
                    <div class="post-thumb">
                        <img src="${post.thumbnail_url || 'https://via.placeholder.com/300x200?text=UMI'}" loading="lazy" style="object-fit:cover;">
                        ${post.view_permission > 0 ? '<span class="post-tag">VIP</span>' : ''}
                    </div>
                    <div class="post-content">
                        <div>
                            <h3 class="post-title">${post.title}</h3>
                            <p class="post-excerpt">${post.excerpt}</p>
                        </div>
                        <div class="post-meta">
                            <span><i class="fa-regular fa-clock"></i> ${new Date(post.created_at * 1000).toISOString().slice(0,10)}</span>
                            ${post.price > 0 ? `<span style="color:#ff6b6b">¥${post.price}</span>` : ''}
                        </div>
                    </div>
                </a>
            `).join('');
            
            renderPagination(json.page, json.totalPages);
        } else {
            // 如果没数据，直接显示暂无
            container.innerHTML = '<div style="text-align:center; padding:50px; color:#999;">暂无文章</div>';
        }
    } catch (e) {
        // 如果出错，显示简单文字，不再转圈
        console.error(e);
        container.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">列表获取失败</div>';
    }
}

function renderPagination(current, total) {
    const pag = document.getElementById('pagination');
    if(!pag) return;
    if(total <= 1) { pag.innerHTML = ''; return; }
    
    let html = '';
    if(current > 1) html += `<button class="page-btn" onclick="loadPosts(${current - 1})">上一页</button>`;
    html += `<span style="padding:8px 12px; color:#999;">${current} / ${total}</span>`;
    if(current < total) html += `<button class="page-btn" onclick="loadPosts(${current + 1})">下一页</button>`;
    pag.innerHTML = html;
}
window.loadPosts = loadPosts;

// --- 以下为弹窗与鉴权逻辑 (保持不变) ---
const userBtn = document.getElementById('userBtn');
const authModal = document.getElementById('authModal');
const payModal = document.getElementById('payModal'); 

function bindGlobalEvents() {
    if(userBtn) {
        userBtn.addEventListener('click', () => {
            const token = localStorage.getItem('umi_token');
            const userStr = localStorage.getItem('umi_user');
            if(token && userStr) showUserCenter(JSON.parse(userStr));
            else openModal('auth');
        });
    }
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
    const adminBtnHtml = (user.role === 'admin') ? `<a href="/admin.html" class="submit-btn" style="display:block;text-align:center;background:#333;margin-top:10px;text-decoration:none;">后台管理</a>` : '';
    card.innerHTML = `<button class="close-btn" onclick="closeModal('authModal')">×</button><div style="text-align:center;"><img src="${user.avatar}" style="width:80px;border-radius:50%;margin-bottom:10px;"><h3>${user.username}</h3><p>身份: ${user.vip_level>0?'VIP':'普通'}</p><button onclick="logout()" style="width:100%;padding:10px;margin-top:15px;border:1px solid #ddd;background:none;border-radius:8px;">退出</button>${adminBtnHtml}</div>`;
    modal.style.display = 'flex';
}

function logout() {
    if(confirm('确定退出？')) { localStorage.removeItem('umi_token'); localStorage.removeItem('umi_user'); location.reload(); }
}

function openModal(type) {
    if(type === 'auth') {
        if(window.authHtmlBackup) document.querySelector('#authModal .modal-card').innerHTML = window.authHtmlBackup;
        authModal.style.display = 'flex'; bindAuthEventsInternal(); loadCaptcha('login');
    }
}

function closeModal(modalId) { 
    document.getElementById(modalId).style.display = 'none'; 
    if(modalId === 'payModal') clearInterval(pollTimer);
}

function bindAuthEventsInternal() {
    document.querySelectorAll('.tab-header span').forEach(span => { 
        span.onclick = function() { switchTab(this.innerText==='登录'?'login':'register'); } 
    });
    const lf = document.getElementById('loginForm'); if(lf) lf.onsubmit = handleLogin;
    const rf = document.getElementById('registerForm'); if(rf) rf.onsubmit = handleRegister;
}

function switchTab(tab) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.tab-header span').forEach(s => s.classList.remove('active'));
    document.getElementById(tab + 'Form').classList.add('active'); loadCaptcha(tab);
}

async function loadCaptcha(type) {
    const lId = type==='login'?'loginCaptchaQuestion':'regCaptchaQuestion'; 
    const kId = type==='login'?'loginCaptchaKey':'regCaptchaKey';
    const label = document.getElementById(lId); if(!label) return;
    label.innerText='...'; 
    try{ 
        const res=await fetch(`${API_BASE}/auth/captcha`); 
        const d=await res.json(); 
        if(d.success){ label.innerText=d.question; document.getElementById(kId).value=d.key; }
    }catch(e){}
}

async function handleLogin(e) { 
    e.preventDefault(); 
    const j=Object.fromEntries(new FormData(e.target)); 
    const r=await fetch(`${API_BASE}/auth/login`,{method:'POST',body:JSON.stringify(j)}); 
    const d=await r.json(); 
    if(d.success){ 
        localStorage.setItem('umi_token',d.token); 
        localStorage.setItem('umi_user',JSON.stringify(d.user)); 
        closeModal('authModal'); location.reload(); 
    }else{ alert(d.message); loadCaptcha('login'); } 
}

async function handleRegister(e) { 
    e.preventDefault(); 
    const j=Object.fromEntries(new FormData(e.target)); 
    const r=await fetch(`${API_BASE}/auth/register`,{method:'POST',body:JSON.stringify(j)}); 
    const d=await r.json(); 
    alert(d.message); 
    if(d.success) switchTab('login'); else loadCaptcha('register'); 
}

// 支付与内页逻辑 (简化保留)
window.createOrder = async function(type, itemId) { 
    const token = localStorage.getItem('umi_token'); if(!token) return openModal('auth');
    const payModal=document.getElementById('payModal'); payModal.style.display='flex';
    document.getElementById('payQrCode').innerText='正在创建...';
    // ... (支付逻辑省略，保持不变)
}

// 文章页初始化
if (document.getElementById('postContent')) {
    // 文章页逻辑 (保留)
}

window.closeModal = closeModal; window.switchTab = switchTab; window.logout = logout;
