/**
 * 封装chokidar适应本地化
 */
const chokidar = require('chokidar');
const lodash = require('lodash');

module.exports = (targetDir, callback, options = {}) => {
  const watcher = chokidar.watch(targetDir, {
    cwd: process.cwd(),
    ignoreInitial: true,
    ...options
  });

  watcher.on('change', lodash.debounce(callback, 200));
  watcher.on('add', callback);
  callback();
}