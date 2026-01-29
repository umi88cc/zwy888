/**
* 优米博客 - 核心逻辑 (含评论/点赞/文章解锁)
*/
const API_BASE = 'https://umi88.cc/api'; 
let pollTimer = null; 
const ITEMS_PER_PAGE = window.innerWidth <= 768 ? 15 : 25;

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('articleList')) loadPosts(1);
    if(document.getElementById('postContent')) initPostPage(); // 文章页逻辑
    bindGlobalEvents();
});

// --- 文章页逻辑 ---
async function initPostPage() {
    const postId = document.getElementById('postId').value;
    loadComments(postId);
    checkLikeStatus(postId);
    
    // 检查登录状态并尝试解锁内容
    const token = localStorage.getItem('umi_token');
    if (token) {
        document.getElementById('loginToComment').style.display = 'none';
        document.getElementById('commentFormBox').style.display = 'block';
        
        try {
            const res = await fetch(`${API_BASE}/posts/content/${postId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('postContent').innerHTML = data.content;
            }
        } catch(e) { console.error('解锁失败', e); }
    }
}

async function loadComments(postId) {
    const list = document.getElementById('commentList');
    try {
        const res = await fetch(`${API_BASE}/comments/list/${postId}`);
        const json = await res.json();
        if (!json.data || json.data.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:#ccc">暂无评论，快来抢沙发</div>';
            return;
        }
        list.innerHTML = json.data.map(c => `
            <div class="comment-item">
                <img src="http://q.qlogo.cn/headimg_dl?dst_uin=${c.qq_number}&spec=100" class="comment-avatar">
                <div class="comment-body">
                    <div class="comment-user">
                        ${c.username}
                        ${c.vip_level > 0 ? `<span class="comment-vip-badge">VIP${c.vip_level}</span>` : ''}
                    </div>
                    <div class="comment-text">${c.content.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>
                    <div class="comment-time">${new Date(c.created_at * 1000).toLocaleString()}</div>
                </div>
            </div>
        `).join('');
    } catch (e) { list.innerHTML = '评论加载失败'; }
}

window.submitComment = async function(postId) {
    const content = document.getElementById('commentContent').value;
    const token = localStorage.getItem('umi_token');
    if (!token) return openModal('auth');
    
    try {
        const res = await fetch(`${API_BASE}/comments/add`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, content })
        });
        const data = await res.json();
        if (data.success) {
            alert('评论成功');
            document.getElementById('commentContent').value = '';
            loadComments(postId);
            setTimeout(() => location.reload(), 1000); 
        } else { alert(data.message || '失败'); }
    } catch (e) { alert('网络错误'); }
};

async function checkLikeStatus(postId) {
    const token = localStorage.getItem('umi_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch(`${API_BASE}/comments/status/${postId}`, { headers });
    const data = await res.json();
    document.getElementById('likeCount').innerText = data.likeCount;
    if (data.hasLiked) {
        const icon = document.getElementById('likeIcon');
        icon.classList.remove('fa-regular'); icon.classList.add('fa-solid');
        icon.parentElement.classList.add('liked');
    }
}

window.toggleLike = async function(postId) {
    const token = localStorage.getItem('umi_token');
    if (!token) return openModal('auth');
    const res = await fetch(`${API_BASE}/comments/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
    });
    const data = await res.json();
    if (data.success) checkLikeStatus(postId);
    else alert(data.error || '失败');
};

// --- 文章加载 (首页) ---
async function loadPosts(page) {
    const container = document.getElementById('articleList');
    if(!container) return;
    container.innerHTML = '<div>Loading...</div>';
    try {
        const res = await fetch(`${API_BASE}/posts/list?page=${page}&limit=${ITEMS_PER_PAGE}`);
        const json = await res.json();
        if(json.success && json.data.length > 0) {
            container.innerHTML = json.data.map(post => `
                <a href="/tech/${post.id}.html" class="post-card">
                    <div class="post-thumb">
                        <img src="${post.thumbnail_url || 'https://via.placeholder.com/300x200'}" loading="lazy">
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
            renderPagination(json.page, json.totalPages);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else { container.innerHTML = '暂无文章'; }
    } catch (e) { container.innerHTML = '加载失败'; }
}
function renderPagination(current, total) {
    const pag = document.getElementById('pagination');
    if(!pag) return; if(total<=1) { pag.innerHTML=''; return; }
    let html='';
    if(current>1) html+=`<button class="page-btn" onclick="loadPosts(${current-1})">上一页</button>`;
    html+=`<span style="padding:8px">第${current}/${total}页</span>`;
    if(current<total) html+=`<button class="page-btn" onclick="loadPosts(${current+1})">下一页</button>`;
    pag.innerHTML=html;
}
window.loadPosts = loadPosts;

// --- 弹窗与鉴权 ---
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
    if(confirm('退出？')) { localStorage.removeItem('umi_token'); localStorage.removeItem('umi_user'); location.reload(); }
}
function openModal(type) {
    if(type === 'auth') {
        if(window.authHtmlBackup) document.querySelector('#authModal .modal-card').innerHTML = window.authHtmlBackup;
        authModal.style.display = 'flex'; bindAuthEventsInternal(); loadCaptcha('login');
    }
}
function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; if(modalId==='payModal') clearInterval(pollTimer); }
function bindAuthEventsInternal() {
    document.querySelectorAll('.tab-header span').forEach(span => { span.onclick = function() { switchTab(this.innerText==='登录'?'login':'register'); } });
    const lf = document.getElementById('loginForm'); if(lf) lf.onsubmit = handleLogin;
    const rf = document.getElementById('registerForm'); if(rf) rf.onsubmit = handleRegister;
}
function switchTab(tab) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.tab-header span').forEach(s => s.classList.remove('active'));
    document.getElementById(tab + 'Form').classList.add('active'); loadCaptcha(tab);
}
async function loadCaptcha(type) {
    const lId = type==='login'?'loginCaptchaQuestion':'regCaptchaQuestion'; const kId = type==='login'?'loginCaptchaKey':'regCaptchaKey';
    const label = document.getElementById(lId); if(!label) return;
    label.innerText='...'; try{ const res=await fetch(`${API_BASE}/auth/captcha`); const d=await res.json(); if(d.success){ label.innerText=d.question; document.getElementById(kId).value=d.key; }}catch(e){}
}
async function handleLogin(e) { e.preventDefault(); const j=Object.fromEntries(new FormData(e.target)); const r=await fetch(`${API_BASE}/auth/login`,{method:'POST',body:JSON.stringify(j)}); const d=await r.json(); if(d.success){ localStorage.setItem('umi_token',d.token); localStorage.setItem('umi_user',JSON.stringify(d.user)); closeModal('authModal'); location.reload(); }else{ alert(d.message); loadCaptcha('login'); } }
async function handleRegister(e) { e.preventDefault(); const j=Object.fromEntries(new FormData(e.target)); const r=await fetch(`${API_BASE}/auth/register`,{method:'POST',body:JSON.stringify(j)}); const d=await r.json(); alert(d.message); if(d.success) switchTab('login'); else loadCaptcha('register'); }

// 支付 (占位)
window.createOrder = async function(type, itemId) { 
    const token = localStorage.getItem('umi_token'); if(!token) return openModal('auth');
    const payModal=document.getElementById('payModal'); payModal.style.display='flex';
    document.getElementById('payQrCode').innerText='正在创建...';
    const res=await fetch(`${API_BASE}/pay/create`,{method:'POST',headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({type,itemId})});
    const d=await res.json(); if(d.success){ document.getElementById('payAmount').innerText='¥'+d.amount; const qr=`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(d.payUrl)}`; document.getElementById('payQrCode').innerHTML=`<img src="${qr}">`; startPolling(d.orderNo); }else{alert(d.message);closeModal('payModal');}
}
function startPolling(no){ if(pollTimer) clearInterval(pollTimer); pollTimer=setInterval(async()=>{try{const r=await fetch(`${API_BASE}/pay/check/${no}`);const d=await r.json();if(d.paid){clearInterval(pollTimer);alert('支付成功');location.reload();}}catch(e){}},2000); }

window.closeModal = closeModal; window.switchTab = switchTab; window.logout = logout;
