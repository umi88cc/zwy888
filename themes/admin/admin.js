// 动态加载受保护的模块
window.loadModule = async function(moduleName) {
    const token = localStorage.getItem('umi_token');
    const container = document.getElementById('module-container');
    
    container.innerHTML = '正在安全加载模块...';

    try {
        // 1. 加载受保护的 CSS
        const cssUrl = `/admin/modules/${moduleName}/style.css`;
        // 我们不能直接用 <link> 标签，因为浏览器请求不会带 Token，会被防火墙拦截！
        // 必须用 fetch 带 Token 请求内容，然后注入页面
        const cssRes = await fetch(cssUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if(cssRes.ok) {
            const cssText = await cssRes.text();
            const style = document.createElement('style');
            style.textContent = cssText;
            style.id = 'module-style';
            // 清理旧样式
            const oldStyle = document.getElementById('module-style');
            if(oldStyle) oldStyle.remove();
            document.head.appendChild(style);
        }

        // 2. 加载受保护的 HTML
        const htmlUrl = `/admin/modules/${moduleName}/view.html`;
        const htmlRes = await fetch(htmlUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        
        if (!htmlRes.ok) throw new Error('无法加载模块文件，权限不足');
        
        const htmlText = await htmlRes.text();
        
        // 3. 渲染 HTML (并执行其中的 script)
        container.innerHTML = htmlText;
        
        // 手动执行 HTML 里的 script 标签 (innerHTML 不会自动执行 script)
        const scripts = container.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            newScript.textContent = oldScript.textContent;
            document.body.appendChild(newScript);
            oldScript.remove(); // 移除原来的
        });

    } catch (e) {
        container.innerHTML = `<div style="color:red; padding:20px;">🛑 加载失败: ${e.message}</div>`;
    }
}
