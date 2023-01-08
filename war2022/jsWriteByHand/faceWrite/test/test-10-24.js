/**
 * 
 */
const _instanceOf = (instance, constructor) => {
  const proto = constructor.protoType;

  let _p = Object.getProtoType(instance);

  while (_p !== null) {
    if (_p === proto) return true;
    
    _p = Object.getProtoType(_p);
  }

  return false;
  
}

var levelOrder = function(root) {
  // defend
  if (root === null) return null;
  // init data
  const res = [];
  const stack = [];
  stack.push(root);
  // algo
  while (stack.length !== 0) {
      const len = stack.length;
      const layer = [];

      for (let i = 0; i < len; i++) {
          const cur = stack.shift();
          if (cur.left) {
              stack.push(cur.left);
          }

          if (cur.right !== null) {
              stack.push(cur.right);
          }
          layer.push(cur.value);
      }

      res.push(layer.slice());
  }
  // return 
  return res;
};

