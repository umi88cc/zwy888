/**
* 前端后台入口
* 路径: themes/admin/admin.js
*/
const API_BASE = '/api/admin';

document.addEventListener('DOMContentLoaded', () => {
    // 1. 立即执行权限检查
    verifyAdminAccess();
});

// --- 权限验证 (门卫) ---
async function verifyAdminAccess() {
    const token = localStorage.getItem('umi_token');
    const userStr = localStorage.getItem('umi_user');

    // 本地校验：没登录直接踢
    if (!token || !userStr) {
        alert('非法访问：请先登录');
        window.location.href = '/';
        return;
    }

    const user = JSON.parse(userStr);
    if (user.role !== 'admin') {
        alert('权限不足：您不是管理员');
        window.location.href = '/';
        return;
    }

    // 服务端校验：尝试连接后台核心
    try {
        const res = await fetch(`${API_BASE}/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            // 校验通过，显示后台界面
            document.getElementById('admin-app').style.display = 'flex';
            console.log('后台连接成功');
        } else {
            throw new Error('服务端拒绝');
        }
    } catch (e) {
        alert('会话失效，请重新登录');
        localStorage.removeItem('umi_token');
        window.location.href = '/';
    }
}

// --- 功能加载器 ---
window.loadModule = async function(moduleName) {
    const token = localStorage.getItem('umi_token');
    const container = document.getElementById('content-area');
    
    container.innerHTML = '加载中...';

    try {
        // 请求后端数据
        const res = await fetch(`${API_BASE}/${moduleName}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        
        // 渲染数据 (这里简单展示，你可以扩展成复杂的表格)
        if (json.success) {
            container.innerHTML = `<pre>${JSON.stringify(json.data, null, 2)}</pre>`;
        } else {
            container.innerHTML = '加载失败: ' + json.message;
        }
    } catch (e) {
        container.innerHTML = '请求错误';
    }
}
