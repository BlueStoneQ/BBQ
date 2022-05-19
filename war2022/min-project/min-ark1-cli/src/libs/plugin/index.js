/**
 * 插件机制核心
 */
const { getCliConfig } = require('../../utils/index');

class PluginDriver {
  constructor() {
    // this.plugins = [];
    this.registerPlugin();
    console.log('this.plugins: ', this.plugins);
  }

  registerPlugin() {
    this.plugins = getCliConfig().plugins;
  }

  hook() {}

  runHook() {}
}

PluginDriver.getSingleInstance = () => {
  return new PluginDriver();
}

module.exports = PluginDriver;