class Node {
  constructor (val, next = null) {
    this.val = val;
    this.next = next;
  }
}

class LinkedList {
  constructor () {
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

   // 增
   add (val) {
    const newNode = new Node(val);
    if (this.size === 0) {
      this.head = newNode;
    }

    this.tail.next = newNode;
    this.tail = newNode;
   }

   // 删
   // 改
   // size
   getSize () {
    return this.size;
   }
}

head -> 5 -> 4 -> 7 -> 3 -> 9 -> 2 -> null

const sort = (head) => {
  // defend
  // init data
  let fast = head;
  let count = 1; // 1代表当前位是奇数，0 偶
  // algo
  while (fast !== null) {
    if (count === 1) {
      // 奇数位情况
      const oushu = fast.next; // 获取偶数位
      const originalHead = head;
      head = oushu;
      fast.next = oushu.next;
      oushu.next = originalHead;
    }
    // 步进
    fast = fast.next;
    count = ++count % 2;
  }
  // return 
  return head;
}


dp[n]

dp[1] = 1;
dp[2] = 2;
dp[3] = dp[2] + 1;

for (let i = 3; i <= n; i++) {
  dp[i] = Math.max(dp[i - 1] + 1, dp[i - 2] + 2);
}

return dp[n];