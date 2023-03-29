/**
 * 2022-6-16
 * 约瑟夫环
 * https://juejin.cn/post/6946136940164939813#heading-56
 * 有30个小孩儿，编号从1-30，围成一圈依此报数，1、2、3 数到 3 的小孩儿退出这个圈， 然后下一个小孩 重新报数 1、2、3，问最后剩下的那个小孩儿的编号是多少?
 * - 其实 这个问题的本质是 约瑟夫环：
 * https://juejin.cn/post/6982522381625458719
 */


/**
 *  方法1： 循环标记
    用一个数组来存储 n 个人在圈内的状态，全部标识为 1，即长度为 n 的数组所有元素都为 1 ，
    用一个报数器来记录报数了几次，只有被标识为 1 的人才能够报数，当报数器的值与 m 相等时，就让这个人离开，则标识为 0，
    并且让记录出圈人数的变量加 1，然后将报数器清零，当纪录变量等于 n-1 时，游戏结束。
 * @param {*} peopleCount 人数
 * @param {*} m 间隔（数到m）时 退出一个小孩
 */
const childNum = (peopleCount, m) => {
  // defend
  if (peopleCount <= 1 || m <= 0) {
    throw new Error('you can\'t play Joseph\'s game. n must be bigger than 1, m must be bigger than 0');
  }

  // 生成一个长度为peopleCount 每个元素为1的标记数组，每个退出的小孩标记为0
  const peoplelist = new Array(peopleCount).fill(1);

  // 重点: 准备初始控制变量: 这几个变量最好用一个对象管理起来
  const curStatus = {
    reportCount: 0, // 临时变量 报数计数：记录本轮报数了几个 到m后需要清0
    curIndex: 0, // 当前报数的小孩的index
    outCount: 0 // 目前一共多少人退出
  }

  // 不断循环 直到最后剩下一个人 结束条件其实： countCount刚刚++后 ===  peopleCount - 1, 增等于留下了一个人
  while (curStatus.outCount < peopleCount - 1) {
    // 当前轮到的人已经退出了 轮下一个人
    if (peoplelist[curStatus.curIndex] === 0) {
      curStatus.curIndex = (curStatus.curIndex+1) % peopleCount; // 保证下标在peopleCount内循环
      continue;
    };
    // 当前人报数
    curStatus.reportCount++;

    // 当前下标的小孩 刚好是第m个 
    if (curStatus.reportCount === m) {
      curStatus.reportCount = 0; // 报数计数清0
      peoplelist[curStatus.curIndex] = 0; // 当前小孩被标记为退出
      curStatus.outCount++; // 一共退出的人计数 ++
    }

    // 下标步进
    curStatus.curIndex = (curStatus.curIndex+1) % peopleCount; // 保证下标在peopleCount内循环
  }

  // 再遍历一遍peopleList 找到值为1的那个元素下标 + 1, 就是留下的小孩的编号(编号从1开始) 
  return peoplelist.indexOf(1) + 1
}

/**
 * test
 */
 console.log(childNum(30, 3)); // expect 29

