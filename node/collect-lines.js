/**
 * 分析生成测试任务信息
 * 1. 命令行给与目录，统计目录下文件的行数等信息
 * 2. 根据行数将文件分配给不同开发人员，进行test覆盖
 * usage: # node ./collect-lines.js ./XXX/xxx
 */
const fs = require('fs')
const path = require('path')
const cp = require('child_process');

// 负责开发的rd list
const rds = ['qiaoyang', 'zhoufan', 'zhuquan', 'yangfan'];

// 获取命令行参数
const parm = process.argv.splice(2)
// 第一个参数是路径
const rootPath = parm[0]
// 后面的所有参数都是文件后缀
let types = parm.splice(1)
if (types.length === 0) types = [ '.js', '.ts' ]
// 需要过滤的文件夹
const filter = [ './node_modules', './.git', './.tscache' ]
// 总计
const total = {
    path: 'total',
    length: 0,
    comment: 0,
}
// 统计结果
const result = []

/**
 * 对指定文件进行统计
 * 包括获取文件行数、注释及计算注释率
 *
 * @param {string} path 文件路径
 */
async function count(path) {
    const rep = await fs.readFileSync(path).toString()
    const lines = rep.split('\n')
    // 匹配出注释的行数
    const commentNum = lines.filter(line => new RegExp('^(//|/\\*|\\*|\\*/)', 'g').test(line.trimStart())).length
    const kong = lines.filter(line => line === '').length;
    const length = lines.length - kong - commentNum;

    result.push({
        path,
        length,
        comment: commentNum,
    });

    updateTotal(lines.length, commentNum)
}

/**
 * 更新总计信息
 * @param {number} length 新增行数
 * @param {number} comment 新增注释
 */
function updateTotal(length, comment) {
    total.length += length;
    total.comment += comment;
}

/**
 * 递归所有文件夹统计
 * @param {string} pt 根目录
 */
async function start(pt) {
    fs.readdirSync(pt).map(file => `${pt}/${file}`)
        .forEach(file => {
            const stat = fs.statSync(file)
            // 是文件夹且不是constants文件就递归
            if (stat.isDirectory()) {
                if (filter.indexOf(pt) !== -1 || file.indexOf('constants') !== -1) return
                return start(file)
            }
            // 是文件并且后缀名符合就执行统计
            if (types.indexOf(path.extname(file)) != -1) count(file)
        })
};

/**
 * allocate()的工具子函数：寻找当前盛放文件行数的最小桶
 * @param {Object} bucketMap 当前桶的信息 { bucket1: [], bucket2: [] } 
 * @returns {String} 最小桶的key
 */
const findMinBucket = (bucketMap) => {
  let minBucketKey= '';
  let minCount = 0;
  const bucketKeyList = Object.keys(bucketMap);
  const bm = {};
  // 统计每个桶的行数
  // console.log('bucketMap: ', bucketMap);
  bucketKeyList.forEach((bucketKey) => {
    bm[bucketKey] || (bm[bucketKey] = { count: 0 });
    bm[bucketKey].count = bucketMap[bucketKey].map(({ length }) => length).reduce((lastLength, currentLength) => {
      return lastLength + currentLength;
    } ,0);
  });
  // 初始化值
  const [ firstBucketKey ] = bucketKeyList;
  minBucketKey = firstBucketKey;
  minCount = bm[firstBucketKey].count;
  // 找到最小的行数的桶
  Object.keys(bm).forEach(bmKey => {
    const currentCount = bm[bmKey].count || 0;
    const isCurrentMin = currentCount < minCount;
      // 更新minkey和minCount
      minCount =  isCurrentMin ? currentCount : minCount;
      minBucketKey =  isCurrentMin ? bmKey : minBucketKey;
  });
  return minBucketKey;
}

/**
 * 根据统计出的结果进行人员的分配
 * Authur: qiaoyang04
 * Date: 2021-3-4
 * 要求：
 * 1. 每个人的行数尽可能接近（最优解）
 * 2. 每个人分配的都是完整的文件（文件为最小分配粒度）
 * 算法设计（类比：垒俄罗斯方块）：
 * 1. 按照行数从大到小对文件进行排序
 * 2. 遍历文件list,每次放之前求出当前最小桶，将文件放入最小桶中
 * @param {Array} fileList 之前程序统计出的文件及行数等信息
 * @param {Array} rdList 开发人员列表
 * @returns {Object} { qiaoyang: [a.js, b.js], zhoufan: [c.js, d.js] ... }
 */
const allocate = (fileList = [], rdList = []) => {
  // 1. 防御 + 参数处理
  // 1.1 初始化部分变量
  // 初始化桶
  const bucket = {};
  rdList.forEach(rd => {
    bucket[rd] = [];
  });
  // 2. 排序
  const fileInfoSortedList = fileList
    .map(({path, length}) => ({
      path,
      length
    }))
    .filter(v => (v.path !== 'total'))
    .sort((a, b) => b.length - a.length);
  // 3. 遍历排序后的列表，依次放入当前盛放行数最小的桶内（注意这里需要一个求当前最小桶的函数）
  fileInfoSortedList.forEach(fileInfo => {
    // 找出当前最小桶(key, 这里就是rd的名字)
    const minBucketKey = findMinBucket(bucket);
    // 将当前文件放入最小桶中
    bucket[minBucketKey].push(fileInfo);
  });
  return bucket;
}

/**
 * 获得每个人的行数
 */
const getBucketLines = (bucket) => {
  const res = {};
  Object.keys(bucket).forEach(bucketKey => {
    res[bucketKey] = bucket[bucketKey]
      .map(({ length }) => length)
      .reduce((lastLength, currentLength) => (lastLength + currentLength), 0);
  });
  return res;
}

(async () => {
    await start(rootPath);
    result.forEach(item => {
        const ex = `git blame ${item.path} | awk \'{ if ( substr($2, 2) ~ "/" ) { authors[substr($3, 2)] += 1 } else authors[substr($2, 2)] += 1 } END { for (name in authors) print name,authors[name] }\'`;
        cp.exec(ex, {}, (err, stdout, stderr) => {
            if (err) {
                return;
            }
            item.blame = stdout.replace(/\n/g, '、').replace(/\s/g, '/').slice(0,-1);
            item.path = item.path.replace('/Users/zhoufan/Desktop/project/mall-wxapp/src/', '');
        });
    });
    result.push(total);
    // print
    setTimeout(() => {
        // console.table(result)
        const allocateRes = allocate(result, rds);
        console.log('分配方案： \n', allocateRes)
        console.log('每人行数统计: \n', getBucketLines(allocateRes));
    } ,2000);
})();