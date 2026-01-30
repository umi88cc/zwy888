/**
* 工具模块: 页面渲染 & 短代码解析
*/

// --- 页面组装 (SSR) ---
export async function renderPage(c, folder, templateName, data = {}) {
    try {
        // 1. 读取布局文件
        const headerRes = await c.env.ASSETS.fetch(new URL('/layout/header.html', c.req.url));
        const footerRes = await c.env.ASSETS.fetch(new URL('/layout/footer.html', c.req.url));
        
        // 2. 读取具体功能页面的 HTML
        // 注意：folder 参数对应 themes 下的子目录，如 'home', 'post', 'admin'
        const bodyRes = await c.env.ASSETS.fetch(new URL(`/${folder}/${templateName}`, c.req.url));

        if (headerRes.status!==200 || footerRes.status!==200 || bodyRes.status!==200) {
            return c.html('<h1>Template Error: 文件缺失</h1>', 500);
        }

        let header = await headerRes.text();
        let footer = await footerRes.text();
        let body = await bodyRes.text();

        // 3. 动态注入 CSS 和 JS 路径
        const pageCss = `<link rel="stylesheet" href="/${folder}/${folder}.css">`;
        const pageJs = `<script src="/${folder}/${folder}.js"></script>`;

        header = header.replace('{{page_title}}', data.title || '优米博客')
                       .replace('{{page_css}}', pageCss);
        
        footer = footer.replace('{{page_js}}', pageJs);

        // 4. 替换内容变量
        for (const [key, value] of Object.entries(data)) {
            // 全局替换 {{key}}
            body = body.replaceAll(`{{${key}}}`, value !== undefined ? value : '');
        }

        return c.html(header + body + footer);
    } catch(e) { 
        return c.text('Render Error: '+e.message, 500); 
    }
}

// --- 短代码解析 ---
export async function parseShortcodes(c, content, userVipLevel = 0, hasBought = false, userId = null, postId = null) {
  if (!content) return '';

  // [vip]
  content = content.replace(/\[vip\]([\s\S]*?)\[\/vip\]/g, (match, inner) => {
    if (userVipLevel >= 1) return `<div class="vip-box unlocked"><i class="fa-solid fa-unlock"></i> VIP内容：${inner}</div>`;
    return `<div class="vip-box locked"><i class="fa-solid fa-lock"></i><h3>VIP 会员可见</h3><button onclick="buyVip()" class="btn-lock">开通会员</button></div>`;
  });
  
  // [svip]
  content = content.replace(/\[svip\]([\s\S]*?)\[\/svip\]/g, (match, inner) => {
    if (userVipLevel >= 2) return `<div class="vip-box unlocked svip"><i class="fa-solid fa-crown"></i> SVIP内容：${inner}</div>`;
    return `<div class="vip-box locked svip"><i class="fa-solid fa-crown"></i><h3>SVIP 至尊可见</h3><button onclick="buyVip()" class="btn-lock">开通SVIP</button></div>`;
  });

  // [pay]
  content = content.replace(/\[pay\]([\s\S]*?)\[\/pay\]/g, (match, inner) => {
    if (hasBought) return `<div class="pay-box unlocked"><i class="fa-solid fa-check-circle"></i> 已购买：${inner}</div>`;
    return `<div class="pay-box locked"><i class="fa-solid fa-coins"></i><h3>付费内容</h3><button onclick="buyPost()" class="btn-lock">立即购买</button></div>`;
  });

  // [reply] 回复可见 (查询数据库)
  if (content.includes('[reply]') && postId) {
      let hasReplied = false;
      if (userId) {
          try {
            const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM comments WHERE user_id=? AND post_id=?').bind(userId, postId).first();
            if (count && count.c > 0) hasReplied = true;
          } catch(e) {}
      }
      
      content = content.replace(/\[reply\]([\s\S]*?)\[\/reply\]/g, (match, inner) => {
          if (hasReplied) return `<div class="reply-box unlocked"><i class="fa-solid fa-comment-dots"></i> 回复内容：${inner}</div>`;
          return `<div class="reply-box locked"><i class="fa-solid fa-comment-slash"></i><h3>回复可见</h3><p>评论后刷新页面查看</p><button onclick="document.querySelector('.comment-section').scrollIntoView({behavior:'smooth'})" class="btn-lock">去评论</button></div>`;
      });
  }

  return content;
}
