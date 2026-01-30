/**
* 模块: 后台防火墙 (Firewall)
* 路径: src/js/firewall.js
* 作用: 拦截对 /admin/ 目录下静态资源（HTML/CSS）的直接访问
*/
import { jwt } from 'hono/jwt';

export const adminFirewall = (jwtConfig) => {
    return async (c, next) => {
        // 1. 初始化 JWT 校验中间件
        const jwtMiddleware = jwt(jwtConfig);
        
        try {
            // 2. 执行校验
            await jwtMiddleware(c, async () => {
                // 3. 校验通过后，进一步检查角色权限
                const payload = c.get('jwtPayload');
                if (!payload || payload.role !== 'admin') {
                    throw new Error('权限不足：非管理员');
                }
            });
        } catch (e) {
            // 4. 校验失败，直接拦截请求，不返回文件内容
            return c.text('⛔️ Access Denied: 受保护的后台资源，禁止非法访问。', 403);
        }
        
        // 5. 一切正常，放行 (允许后续逻辑读取文件)
        await next();
    };
};
