const path = require('path');
const startServer = require('../../libs/server/server');
const watch = require('../../libs/watch');

const cwd = process.cwd();

module.exports = async (opt) => {
  // 鉴权：需要向云端k:v库请求物料信息 + 代码
  // 检查: meta等信息
  // const USER_HOME = process.env.HOME || process.env.USERPROFILE;
  // console.log('USER_HOME: ', USER_HOME);
  // 监听项目文件变动 - 实时触发构建
  const targetPaths = [path.join(cwd, 'src'), path.join(cwd, 'page-data')];
  watch(targetPaths, async (changedFilePath) => {
    console.log('dev changedFilePath: ', changedFilePath)
    // build 2 .dist-data
  });
  // 启动本地服务器
  await startServer();
}