/**
 * 插件机制核心
 */
const { getCliConfig } = require('../../utils/index');

class PluginDriver {
  constructor() {
    this.plugins = [];
    this.registerPlugin();
    console.log('this.plugins: ', this.plugins);
  }

  registerPlugin() {
    this.plugins = getCliConfig().plugins;
  }

  async runHooks(hookName, params) {
    this.plugins.forEach(element => {
      console.log('element: ', element[hookName]);
      // 如果当前插件定义了该hookName的回调 那么 则执行该回调
      if (element[hookName]) {
        element[hookName]({ ...params });
      }
    });
  }
}

PluginDriver.getSingleInstance = () => {
  return new PluginDriver();
}

module.exports = PluginDriver;