const source = [
  { pid: null, id: 1, data: "1" },
  { pid: 1, id: 2, data: "2-1" },
  { pid: 1, id: 3, data: "2-2" },
  { pid: 2, id: 4, data: "3-1" },
  { pid: 3, id: 5, data: "3-2" },
  { pid: 4, id: 6, data: "4-1" },
];

// 方法1：先构建map 再构建tree
const flatObj2Tree1 = (list) => {
  const res = []
  const map = new Map()

  for (const item of list) {
    const { id } = item

    map.set(id, item)
  }

  for (const item of list) {
    const { pid } = item

    delete item.pid

    // 根节点
    if (pid === null) {
      res.push(item)
    }
    // 普通节点
    if (map.has(pid)) {
      const parentItem = map.get(pid)

      parentItem.children = [].concat(parentItem.children || [], item)
    }
  }

  return res
}

console.log('test1: ', JSON.stringify(flatObj2Tree1(source), 2))

const sorce2 = [
  {
    "id":1,
    "data":"1",
    "children":[
      {
        "id":2,
        "data":"2-1",
        "children":[
          {
            "id":4,
            "data":"3-1",
            "children":[
              {
                "id":6,
                "data":"4-1"
              }
            ]
          }
        ]
      },
      {
        "id":3,
        "data":"2-2",
        "children":[
          {
            "id":5,
            "data":"3-2"
          }
        ]
      }
    ]
  }
]

const tranverse = (tree) => {
  const result = []

  const _tranverse = (_tree) => {
    if (!_tree) return
  
    if (!_tree.children) {
      result.push(_tree)
      return
    }
  
    
    for (const item of _tree.children) {
      result.push(tranverse(item))
    }

    delete _tree.children
  }

  _tranverse(tree)

  return result
}

console.log('tanverse: ', JSON.stringify(tranverse(parse)))