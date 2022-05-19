const path = require('path');
const startServer = require('../../libs/server/server');
const watch = require('../../libs/watch');
const build = require('../../libs/build/index');
const PluginDriver = require('../../libs/plugin/index');

const cwd = process.cwd();

module.exports = async (opt) => {
  // 鉴权：需要向云端k:v库请求物料信息 + 代码
  // 检查: meta等信息
  // const USER_HOME = process.env.HOME || process.env.USERPROFILE;
  // console.log('USER_HOME: ', USER_HOME);
  const cliContext = {};

  // 初始化pluginDriver 插件系统
  cliContext.pluginDriver = PluginDriver.getSingleInstance();

  // 监听项目文件变动 - 实时触发构建
  const targetPaths = [path.join(cwd, 'src'), path.join(cwd, 'page-data')];
  watch(targetPaths, async (changedFilePath) => {
    // 第一次执行 build整个src下的文件
    // changedFilePath = changedFilePath || 'src'; // 正式语句
    changedFilePath = 'src'; // 临时用src下全体进行build
    console.log('dev changedFilePath: ', changedFilePath)
    // build file to cwd/.dist-data
    await build(path.join(cwd, changedFilePath));
  });
  // 启动本地服务器
  await startServer(cliContext);
}