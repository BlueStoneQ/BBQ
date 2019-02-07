/**
 * components-Icon
 * 1- 栅格组件：24等分
 * 2- 响应式：xl>=1200px lg>=1024px md>=768 md<=768
 */
import React, { Component } from 'react';
import './index.css';

/**
 * Icon
 */
class Icon extends Component {
  render() {
    // console.log('process.env.PUBLIC_URL: ', process.env.PUBLIC_URL); // 空的哈哈
    const {
      imgUrl,
      width,
      height,
      backSize,
      borderRadius
    } = this.props; 
    return (
      <i
        className='icon-wrap'
        style={{
          backgroundImage: 'url(' + process.env.PUBLIC_URL + imgUrl + ')',
          width: width || '100%',
          height: height || '100%',
          backgroundSize: backSize,
          borderRadius: borderRadius || 0 
        }}
      />
    );
  }
}

export default Icon;
