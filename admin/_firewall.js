/**
* 后台防火墙 (Firewall)
* 作用：拦截所有对 /admin 目录下静态资源的直接访问
*/
import { jwt } from 'hono/jwt';

export const adminFirewall = (jwtConfig) => {
    return async (c, next) => {
        // 1. 尝试 JWT 校验
        const jwtMiddleware = jwt(jwtConfig);
        try {
            await jwtMiddleware(c, async () => {
                // 2. 校验成功后，检查角色
                const payload = c.get('jwtPayload');
                if (payload.role !== 'admin') {
                    throw new Error('非管理员');
                }
            });
        } catch (e) {
            // 3. 校验失败，直接拒绝
            return c.text('⛔️ Access Denied: 这是一个受保护的后台文件，禁止非法访问。', 403);
        }
        
        // 4. 校验通过，放行
        await next();
    };
};
