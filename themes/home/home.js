const ITEMS_PER_PAGE = window.innerWidth <= 768 ? 15 : 25;

document.addEventListener('DOMContentLoaded', () => {
    loadPosts(1);
});

async function loadPosts(page) {
    const container = document.getElementById('articleList');
    if(!container) return;
    
    try {
        const res = await fetch(`/api/posts/list?page=${page}&limit=${ITEMS_PER_PAGE}&t=${Date.now()}`);
        const json = await res.json();
        
        if(json.success && json.data.length > 0) {
            container.innerHTML = json.data.map(p => `
                <a href="/post/${p.id}.html" class="post-card">
                    <div class="post-thumb">
                        <img src="${p.thumbnail_url || 'https://via.placeholder.com/300'}" loading="lazy">
                        ${p.view_permission > 0 ? '<span class="post-tag">VIP</span>' : ''}
                    </div>
                    <div class="post-content">
                        <div><div class="post-title">${p.title}</div><div class="post-excerpt">${p.excerpt}</div></div>
                        <div class="post-meta"><span><i class="fa-regular fa-clock"></i> ${new Date(p.created_at*1000).toLocaleDateString()}</span></div>
                    </div>
                </a>
            `).join('');
            renderPagination(json.page, json.totalPages);
        } else {
            container.innerHTML = '<div style="text-align:center;padding:50px;color:#999">暂无文章</div>';
        }
    } catch(e) { container.innerHTML = '<div style="text-align:center;color:#999">加载失败</div>'; }
}

function renderPagination(current, total) {
    const el = document.getElementById('pagination');
    if(total <= 1) { el.innerHTML = ''; return; }
    let html = '';
    if(current > 1) html += `<button class="page-btn" onclick="loadPosts(${current-1})">上一页</button>`;
    html += `<span style="padding:5px 10px;color:#999">${current} / ${total}</span>`;
    if(current < total) html += `<button class="page-btn" onclick="loadPosts(${current+1})">下一页</button>`;
    el.innerHTML = html;
}
