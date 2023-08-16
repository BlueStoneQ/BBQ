/**
 * 2023-8-10
 *  url的编码处理
 *  将url中的字母换成ascall码
 *  提供encode + decode 配套函数
 */

// 分隔符
const SEP = ',';

const _URLencode = (url = '') => {
    return url.replace(/([0-9a-zA-Z])/g, (match, p1) => p1.charCodeAt() + SEP).split(SEP);
}

const _URLdecode = (urlEncodeNumArr = []) => {
    return urlEncodeNumArr.map(urlEncodeNum => String.fromCharCode(urlEncodeNumArr)).join('');
}

const inputs = [
    'https://tripdocs.nfes.ctripcorp.com/tripdocs/book?dynamicDir=698&docId=2976'
];

const print = (inputs = []) => {
    inputs.forEach((input) => {
        const encodeUrl = _URLencode(input);
        const decodeUrl = _URLdecode(encodeUrl);
        console.log(`${input} \n _encode: ${_URLencode(input)}`)
        console.log(`_decode: ${decodeUrl}`)
    })
}

print(inputs);