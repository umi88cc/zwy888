/**
* 优米博客 - 核心逻辑 (修复版)
*/
const API_BASE = 'https://umi88.cc/api'; 
let pollTimer = null; 
const ITEMS_PER_PAGE = window.innerWidth <= 768 ? 15 : 25;

// 确保 DOM 加载后执行
document.addEventListener('DOMContentLoaded', () => {
    console.log('App Started');
    if(document.getElementById('articleList')) {
        loadPosts(1);
    }
    bindGlobalEvents();
});

// 加载文章列表
async function loadPosts(page) {
    const container = document.getElementById('articleList');
    if(!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:50px; color:#999;">正在加载文章...</div>';

    try {
        // 加时间戳防止缓存
        const res = await fetch(`${API_BASE}/posts/list?page=${page}&limit=${ITEMS_PER_PAGE}&t=${Date.now()}`);
        
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        
        const json = await res.json();
        console.log('Posts Loaded:', json);

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
            container.innerHTML = `
                <div style="text-align:center; padding:50px;">
                    <i class="fa-solid fa-inbox" style="font-size:3rem; color:#eee; margin-bottom:10px;"></i>
                    <p style="color:#999;">暂无文章，请去后台发布一篇吧！</p>
                </div>`;
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="text-align:center; color:red; padding:30px;">加载失败: ${e.message}</div>`;
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

// ... (以下保持之前的弹窗/登录/支付逻辑不变，请直接保留你之前复制的剩余代码，或者如果需要完整的我可以再发一次) ...
// 为了保险，我把基础的绑定也补全：

const userBtn = document.getElementById('userBtn');
const authModal = document.getElementById('authModal');

function bindGlobalEvents() {
    if(userBtn) {
        userBtn.addEventListener('click', () => {
            const token = localStorage.getItem('umi_token');
            if(token) alert('已登录 (个人中心开发中)'); 
            else openModal('auth');
        });
    }
    // 关闭按钮
    document.addEventListener('click', (e) => {
        if(e.target.classList.contains('close-btn') || e.target.classList.contains('modal-overlay')) {
            const modal = e.target.closest('.modal-overlay');
            if(modal) modal.style.display = 'none';
        }
    });
    
    // Tab 切换
    const tabs = document.querySelectorAll('.tab-header span');
    tabs.forEach(t => t.onclick = function() {
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.getElementById(this.innerText==='登录'?'loginForm':'registerForm').classList.add('active');
        tabs.forEach(x=>x.classList.remove('active'));
        this.classList.add('active');
    });
}

function openModal(id) { document.getElementById(id+'Modal').style.display='flex'; }
window.openModal = openModal;
