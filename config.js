// config.js
const Config = {
    siteName: "优米博客",
    domain: "https://umi88.cc",
    
    // API 地址 (如果是同源部署，通常是 /api)
    apiBaseUrl: "/api",

    // 支付配置 (敏感信息建议放在 Worker 环境变量，这里放公开配置)
    payment: {
        method: "alipay_face_to_face", // 当面付
        currency: "CNY"
    },

    // 角色对应 ID 映射
    roles: {
        user: 0,
        vip: 1,
        svip: 2,
        admin: 99
    },

    // 主题设置
    theme: "zwy888"
};

// 兼容前后端导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;
}
