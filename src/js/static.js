/**
* 模块: 静态资源代理
*/
import { Hono } from 'hono';
const app = new Hono();

// 图片代理
app.get('/images/*', async (c) => {
  const key = c.req.path.substring(1); 
  const object = await c.env.IMG_BUCKET.get(key); 
  if (!object) return c.text('404 Not Found', 404);
  
  const h = new Headers(); 
  object.writeHttpMetadata(h); 
  h.set('etag', object.httpEtag); 
  return new Response(object.body, { headers: h });
});

// 兜底静态资源 (CSS/JS)
app.get('/*', async (c) => { 
    return c.env.ASSETS.fetch(c.req.raw); 
});

export default app;
