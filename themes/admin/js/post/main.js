/**
* 文章管理前端逻辑
* 路径: themes/admin/js/post/main.js
*/
(function() {
    console.log('Post Module Loaded');
    loadPosts(); // 进页面先加载一次

    // --- 1. 加载列表 ---
    window.loadPosts = async function() {
        const token = localStorage.getItem('umi_token');
        const listDiv = document.getElementById('postListView');
        const tableBody = document.getElementById('postTable');
        
        try {
            const res = await fetch('/api/admin/posts', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            
            if (json.success) {
                if (json.data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">暂无文章，请点击发布</td></tr>';
                } else {
                    tableBody.innerHTML = json.data.map(p => `
                        <tr>
                            <td>${p.id}</td>
                            <td style="font-weight:bold;">${p.title}</td>
                            <td><span style="background:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;font-size:12px;">${p.status}</span></td>
                            <td>${p.price > 0 ? '¥'+p.price : '免费'}</td>
                            <td>
                                <button class="btn btn-primary" style="padding:4px 8px;" onclick='editPost(${JSON.stringify(p)})'>编辑</button>
                                <button class="btn btn-danger" style="padding:4px 8px;margin-left:5px;" onclick='deletePost(${p.id})'>删</button>
                            </td>
                        </tr>
                    `).join('');
                }
            } else {
                alert('加载失败: ' + json.message);
            }
        } catch (e) {
            console.error(e);
            tableBody.innerHTML = '<tr><td colspan="5">加载出错</td></tr>';
        }
    };

    // --- 2. 显示/隐藏编辑器 ---
    window.showEditor = function() {
        document.getElementById('postListView').style.display = 'none';
        document.getElementById('postEditor').style.display = 'block';
        document.getElementById('postForm').reset();
        document.querySelector('[name=id]').value = ''; // 清空ID表示新增
    };

    window.hideEditor = function() {
        document.getElementById('postListView').style.display = 'block';
        document.getElementById('postEditor').style.display = 'none';
    };

    // --- 3. 编辑回显 ---
    window.editPost = function(p) {
        showEditor();
        const f = document.getElementById('postForm');
        f.id.value = p.id;
        f.title.value = p.title;
        f.slug.value = p.slug || '';
        f.content.value = p.content;
        f.price.value = p.price || 0;
        f.view_permission.value = p.view_permission || 0;
    };

    // --- 4. 提交保存 (关键) ---
    const form = document.getElementById('postForm');
    // 防止重复绑定
    form.onsubmit = null; 
    form.onsubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('umi_token');
        const formData = new FormData(e.target);
        
        // 转换数据类型，防止传字符串给数字字段
        const data = Object.fromEntries(formData);
        
        try {
            const res = await fetch('/api/admin/posts/save', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const json = await res.json();
            
            if (json.success) {
                alert('🎉 发布成功！');
                hideEditor();  // 关掉编辑器
                loadPosts();   // 🔄 立即刷新列表
            } else {
                alert('😭 失败: ' + json.message);
            }
        } catch (e) {
            alert('网络错误');
        }
    };

    // --- 5. 删除 ---
    window.deletePost = async function(id) {
        if(!confirm('确定删除吗？')) return;
        const token = localStorage.getItem('umi_token');
        await fetch('/api/admin/posts/delete', {
            method:'POST', 
            headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
            body:JSON.stringify({id})
        });
        loadPosts();
    };

})();
