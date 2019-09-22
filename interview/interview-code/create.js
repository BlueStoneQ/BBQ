/**
 * 模拟实现Object.create
 * 1. 使用现有对象proto来提供新对象的__proto__, 那么，这就天然地可以参与继承
 */
function create(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F(); 
}