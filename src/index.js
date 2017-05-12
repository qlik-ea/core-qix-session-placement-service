const process = require('process');
const Koa = require('koa');
const Router = require('koa-router');
const logger = require('winston');
const koaLoggerWinston = require('koa-logger-winston');
const Config = require('./Config');
const qixSessionService = require('./QixSessionService');
const swagger = require('swagger2');
const swagger2koa = require('swagger2-koa');
const path = require('path');

const apiVersion = 'v1';
const healthEndpoint = 'health';
const sessionEndpoint = 'session';
const app = new Koa();
const router = new Router({ prefix: `/${apiVersion}` });
const config = new Config();
const document = swagger.loadDocumentSync(path.join(__dirname, './../doc/api-doc.yml'));

router.get(`/${healthEndpoint}`, async (ctx) => { ctx.body = 'OK'; });

router.get(`/${sessionEndpoint}/doc/:docId`, async (ctx) => {
  const fullDocId = `/doc/${ctx.params.docId}`;
  const sessionInfo = await qixSessionService.openSession(fullDocId);
  ctx.body = JSON.stringify(sessionInfo, undefined, '   ');
});

router.get(`/${sessionEndpoint}/session-doc`, async (ctx) => {
  const sessionInfo = await qixSessionService.openSession('');
  ctx.body = JSON.stringify(sessionInfo, undefined, '   ');
});

app
  .use(swagger2koa.ui(document, '/openapi'))
  .use(koaLoggerWinston(logger))
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(config.port);

process.on('SIGTERM', () => {
  app.close(() => {
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error(reason);
});

logger.info(`Listening on port ${config.port}`);
