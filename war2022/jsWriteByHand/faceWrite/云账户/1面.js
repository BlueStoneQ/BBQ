/**
 * 2022-11-14
 * 给定一个字符串 s 和一些长度相同的单词 words 。找出 s 中恰好可以由 words 中所有单词串联形成的子串的起始位置。 （注意子串要与 words 中的单词完全匹配，中间不能有其他字符 ，但不需要考虑 words 中单词串联的顺序。）
示例 1： 输入：s = "barfoothefoobarman", words = ["foo","bar"] 输出：[0,9] 解释： 从索引 0 和 9 开始的子串分别是 "barfoo" 和 "foobar" 。 输出的顺序不重要, [9,0] 也是有效答案。
示例 2： 输入：s = "wordgoodgoodgoodbestword", words = ["word","good","best","word"] 输出：[]
示例 3： 输入：s = "barfoofoobarthefoobarman", words = ["bar","foo","the"] 输出：[6,9,12]
 */


/**
 * me: 解决方案：分治
 */

 const getAllCombination = (words) => {
  if (!words || words.length === 0) return [];
  
  const wordsLen = words.length;
  const result = [];
  
  const _DFS = (path, startIndex) => {
      if (path.length === wordsLen) {
          result.push(path.join(''));
          return;
      }
      
      for (let i = startIndex; i < wordsLen; i++) {
          const curWord = words[i];
          
          path.push(curWord);
          _DFS(path, startIndex + 1);
          path.pop();
      }
  }
  
  _DFS([], 0);
  
  return result;
}

const findPerSubstring = (str, subStr) => {
  let index = 0, subIndex = 0;
  let start = -1;
  
  while (index < str.length) {
      if (str[index] === subStr[subIndex]) {
          if (subIndex === 0) {
              start = index;
          }
          
          if (subIndex === subStr.length - 1) {
              return start;
          }
          
          subIndex++;
      } else {
          subIndex = 0;
          start = -1;
      }
      
      index++;
  }
  return start;
}

/**
* @param s string 字符串
* @param words string[] 字符串一维数组
* @return number[] 一维数组
*/
function findSubstring( s ,  words ) {
 // defend
 // init data
 const result = [];
 const subStrList = getAllCombination(words);
 // algo
 for (let subStr of subStrList) {
     const startIndex = findPerSubstring(s, subStr);
     if (startIndex > -1) {
         result.push(startIndex);        
     }
 }
 // return 
 return result;
}
