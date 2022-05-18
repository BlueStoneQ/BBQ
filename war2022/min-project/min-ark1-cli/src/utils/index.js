const { exec } = require('child_process');
const { version } = require('os');
const semver = require('semver');
const pkg = require('../../package.json');

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
  await execPromise(`npm info ${pkgName} version`).then(latestVer => {
    // 线上最新版本 和 当前pkg.version中版本进行semver进行比较，当当前版本小于线上版本时，提示用户进行更新版本
    if (semver.lt(pkg.version, latestVer)) {
      console.log(`${pkg.name}有新版本${latestVer}发布啦, 执行npm i ${pkg.name} 升级最新版!`);
    }
  });
}

module.exports = {
  execPromise,
  checkSelfIsNeedUpdate
}