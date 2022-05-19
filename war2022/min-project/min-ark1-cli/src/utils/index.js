const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const semver = require('semver');
const downLoad = require('download-package-tarball');
const fs = require('fs-extra');
const pkg = require('../../package.json');
const config = require('../../config/index');

/**
 * 执行shell 
 * 可以用shellJs.exec() 
 * 也可以这里简单封装 
 */
const execPromise = async (command, config = {}) => new Promise((resolve, reject) => {
  // defend - throw error
  // 执行
  exec(command, config, (err, stdout, stderr) => {
    if (err) return reject(err);
    stdout = stdout.replace(/$\r|\n/, '');
    resolve(stdout);
  });
});

/**
 * 检查cmd自身是否需要更新
 */
const checkSelfIsNeedUpdate = async () => {
  // const pkgName = pkg.name;
  // 这里因为我们没有publish 所以 使用react的版本哈哈
  const pkgName = 'react';
  // 通过执行npm info pak.name version 获取到当前线上的version
  const latestVer = await execPromise(`npm info ${pkgName} version`);
  // 线上最新版本 和 当前pkg.version中版本进行semver进行比较，当当前版本小于线上版本时，提示用户进行更新版本
  if (semver.lt(pkg.version, latestVer)) {
    console.log(`${pkg.name}有新版本${latestVer}发布啦, 执行npm i ${pkg.name} 升级最新版!`);
  }
}

/**
 * 下载npm包到指定的路径
 */
const downloadNpm = async ({ packgeName, targetPath = process.cwd() }) => {
  // defend参数
  // 分析参数
  const tempDir = config.temp || os.tmpdir();
  console.log('tempDir: ', tempDir);
  console.log('targetPath: ', targetPath);
  // 参数准备：获得获得packageName的最新版本号
  const latestVersion = await execPromise(`npm info ${packgeName} version`);
  // 下载tar包-到指定的temp目录
  await downLoad({
    url: `https://registry.npmjs.org/${packgeName}/-/${packgeName}-${latestVersion}.tgz`, // 
    dir: tempDir
  });
  // copy到targetPath:这里的copy其实 本来的用意是可以copy下载到的npm包具体某个目录
  await fs.copy(
    path.resolve(tempDir, packgeName), 
    targetPath,
    { overwrite: true }
  );
  // 删除temp目录中的缓存源文件
  await fs.remove(path.join(tempDir, packgeName));
}

/**
 * 获得项目中的cli.config.js
 */
const getCliConfig = () => {
  return require(path.join(process.cwd(), 'cli.config.js'));
}

module.exports = {
  execPromise,
  checkSelfIsNeedUpdate,
  downloadNpm,
  getCliConfig
}