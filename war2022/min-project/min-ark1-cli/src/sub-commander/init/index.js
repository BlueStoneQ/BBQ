/**
 * 下载项目模板 + copy项目模板到cli执行的目录
 */
const { downloadNpm } = require('../../utils/index');

module.exports = async (opt) => {
  // 分析参数
  const projName = opt.projectName || 'new project';
  const targetPath = process.cwd();
  // 下载proj模板 这里暂时用snappy
  await downloadNpm({
    packgeName: 'snappy',
    targetPath
  });
  // 根据name等init入参修改下载包的相关信息 - 定制化
}
