/**
 * 日期格式化函数
 * 2022-3-17
 */

/**
 * 
 * @param {Date} date 
 * @param {string} format  yyyy MM dd 年月日
 */
const dateFormat = (date, format = 'yyyy/MM/dd') => {
  // defend
  if (!date) return '';
  if (Object.prototype.toString.call(date) !== '[object Date]') return '';

  // init data
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  // algo: 其实就是在模版中用实际的数字替换相关占位符
  format = format.replace(/dd/, day);
  format = format.replace(/MM/, month);
  format = format.replace(/yyyy/, year);

  // return 
  return format;
}


const test = () => {
  console.log(dateFormat(new Date('2020-12-01'), 'yyyy/MM/dd')) // 2020/12/01
  console.log(dateFormat(new Date('2020-04-01'), 'yyyy/MM/dd')) // 2020/04/01
  console.log(dateFormat(new Date('2020-04-01'), 'yyyy年MM月dd日')) // 2020年04月01日
}

test();