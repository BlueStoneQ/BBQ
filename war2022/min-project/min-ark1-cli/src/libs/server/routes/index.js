const KoaRouter = require('koa-router');
const router = new KoaRouter();

router.get('/', async (ctx) => {
  ctx.body = "server运行中";
});

router.get('/file', async (ctx, next) => {
  // 获取更改后 + build之后的文件
  ctx.body = await getContentData();
});

module.exports = router;