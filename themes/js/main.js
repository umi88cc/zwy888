/**
* 优米博客 - 核心逻辑 (修复版 + 自动登录)
*/
const API_BASE = 'https://umi88.cc/api'; 
let pollTimer = null; 
const ITEMS_PER_PAGE = window.innerWidth <= 768 ? 15 : 25;

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('articleList')) loadPosts(1);
    if(document.getElementById('postContent')) initPostPage();
    bindGlobalEvents();
});

// ... (loadPosts, renderPagination 等文章加载逻辑保持不变，复制你之前的即可，或者只替换下面的 Auth 部分) ...
// 为防止遗漏，建议只复制下面的 bindGlobalEvents 及其之后的 Auth 逻辑覆盖到你的 main.js 后半部分

// --- 弹窗与鉴权逻辑 ---
const userBtn = document.getElementById('userBtn');
const authModal = document.getElementById('authModal');

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
    
    // Tab 切换
    const tabs = document.querySelectorAll('.tab-header span');
    tabs.forEach(t => t.onclick = function() {
        switchTab(this.innerText.trim()==='登录'?'login':'register');
    });

    const lf = document.getElementById('loginForm'); if(lf) lf.onsubmit = handleLogin;
    const rf = document.getElementById('registerForm'); if(rf) rf.onsubmit = handleRegister;
}

function switchTab(tabName) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.tab-header span').forEach(s => s.classList.remove('active'));
    
    document.getElementById(tabName + 'Form').classList.add('active');
    
    // 找到对应的 tab 按钮并高亮
    const tabs = document.querySelectorAll('.tab-header span');
    if(tabName === 'login') tabs[0].classList.add('active');
    else tabs[1].classList.add('active');

    loadCaptcha(tabName);
}

// 注册 (自动登录逻辑)
async function handleRegister(e) { 
    e.preventDefault(); 
    const j=Object.fromEntries(new FormData(e.target)); 
    
    try {
        const r=await fetch(`${API_BASE}/auth/register`,{method:'POST',body:JSON.stringify(j)}); 
        const d=await r.json(); 
        
        if(d.success) {
            // 注册成功，直接保存 Token 实现自动登录
            localStorage.setItem('umi_token', d.token);
            localStorage.setItem('umi_user', JSON.stringify(d.user));
            alert(d.message); 
            closeModal('authModal'); 
            location.reload(); 
        } else {
            alert(d.message); 
            loadCaptcha('register'); 
        }
    } catch(err) {
        alert('请求失败');
    }
}

// 登录
async function handleLogin(e) { 
    e.preventDefault(); 
    const j=Object.fromEntries(new FormData(e.target)); 
    try {
        const r=await fetch(`${API_BASE}/auth/login`,{method:'POST',body:JSON.stringify(j)}); 
        const d=await r.json(); 
        if(d.success){ 
            localStorage.setItem('umi_token',d.token); 
            localStorage.setItem('umi_user',JSON.stringify(d.user)); 
            closeModal('authModal'); 
            location.reload(); 
        } else { 
            alert(d.message); 
            loadCaptcha('login'); 
        } 
    } catch(err) { alert('请求失败'); }
}

// ... (其余辅助函数保持不变) ...
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

function showUserCenter(user) {
    const modal = document.getElementById('authModal');
    const card = modal.querySelector('.modal-card');
    if(!window.authHtmlBackup) window.authHtmlBackup = card.innerHTML;
    const adminBtnHtml = (user.role === 'admin') ? `<a href="/admin.html" class="submit-btn" style="display:block;text-align:center;background:#333;margin-top:10px;text-decoration:none;">后台管理</a>` : '';
    card.innerHTML = `<button class="close-btn" onclick="closeModal('authModal')">×</button><div style="text-align:center;"><img src="${user.avatar}" style="width:80px;border-radius:50%;margin-bottom:10px;border:3px solid #eee;"><h3>${user.username}</h3><p style="color:#888;margin-bottom:15px;">${user.vip_level>0?'<span style="color:#ff6b6b;font-weight:bold">VIP会员</span>':'普通用户'}</p><button onclick="logout()" style="width:100%;padding:10px;border:1px solid #ddd;background:none;border-radius:12px;cursor:pointer;">退出登录</button>${adminBtnHtml}</div>`;
    modal.style.display = 'flex';
}

function logout() { if(confirm('确定退出？')) { localStorage.removeItem('umi_token'); localStorage.removeItem('umi_user'); location.reload(); } }
function openModal(id) { if(id==='auth' && window.authHtmlBackup) document.querySelector('#authModal .modal-card').innerHTML=window.authHtmlBackup; document.getElementById(id+'Modal').style.display='flex'; if(id==='auth') { bindAuthEventsInternal(); loadCaptcha('login'); } }
function closeModal(id) { document.getElementById(id).style.display='none'; if(id==='payModal') clearInterval(pollTimer); }
function bindAuthEventsInternal(){ 
    document.querySelectorAll('.tab-header span').forEach(s => s.onclick = function(){ switchTab(this.innerText.trim()==='登录'?'login':'register'); });
    const lf = document.getElementById('loginForm'); if(lf) lf.onsubmit = handleLogin;
    const rf = document.getElementById('registerForm'); if(rf) rf.onsubmit = handleRegister;
}

// 文章加载 (如果你之前没复制全，这里补上最上面的 loadPosts)
async function loadPosts(page) {
    const container = document.getElementById('articleList');
    if(!container) return;
    try {
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
                        <div><h3 class="post-title">${post.title}</h3><p class="post-excerpt">${post.excerpt}</p></div>
                        <div class="post-meta"><span><i class="fa-regular fa-clock"></i> ${new Date(post.created_at * 1000).toISOString().slice(0,10)}</span>${post.price > 0 ? `<span style="color:#ff6b6b">¥${post.price}</span>` : ''}</div>
                    </div>
                </a>
            `).join('');
            renderPagination(json.page, json.totalPages);
        } else { container.innerHTML = '<div style="text-align:center;padding:50px;color:#999;">暂无文章</div>'; }
    } catch (e) { container.innerHTML = '<div style="text-align:center;padding:50px;color:#999;">连接失败</div>'; }
}
function renderPagination(current, total) {
    const pag = document.getElementById('pagination'); if(!pag)return; if(total<=1){pag.innerHTML='';return;}
    let html=''; if(current>1) html+=`<button class="page-btn" onclick="loadPosts(${current-1})">上一页</button>`;
    html+=`<span style="padding:8px 12px;color:#999">${current} / ${total}</span>`;
    if(current<total) html+=`<button class="page-btn" onclick="loadPosts(${current+1})">下一页</button>`;
    pag.innerHTML=html;
}
window.loadPosts = loadPosts;
