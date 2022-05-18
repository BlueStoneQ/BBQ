const startServer = require('./server');

module.exports = async (opt) => {
  // 鉴权：需要向云端k:v库请求物料信息 + 代码
  // 检查: meta等信息
  // const USER_HOME = process.env.HOME || process.env.USERPROFILE;
  // console.log('USER_HOME: ', USER_HOME);
  // 启动本地服务器
  await startServer();
}