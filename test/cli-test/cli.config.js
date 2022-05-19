/**
 * 其实插件的本质是 
 * {
 *  name: 插件名，
 *  hook1: () => {},
 *  hook2: () => {}
 * }
 */
const addRoutesPlugin = require('./plugins/addRoutesPlugin');

module.exports = {
  plugin: [ addRoutesPlugin() ]
}