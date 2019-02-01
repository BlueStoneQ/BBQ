/**
 * components-card
 * 1- 卡片组件 - 暂时不添加title
 * 2- 其他业务型的卡片由此继承
 * 3- props暴露: background padding
 */
import React, { Component } from 'react';
import './index.css';

/**
 * Card
 */
class Card extends Component {
  render() {
    console.log('process.env.PUBLIC_URL: ', process.env.PUBLIC_URL); // 空的哈哈
    const {
      imgUrl,
      width,
      height,
      backSize,
      borderRadius
    } = this.props; 
    return (
      <div
        className='Card-wrap'
        style={{
          backgroundImage: 'url(' + process.env.PUBLIC_URL + imgUrl + ')',
          width: width || '100%',
          height: height || '100%',
          backgroundSize: backSize,
          borderRadius: borderRadius || 0 
        }}
      >
      { this.props.children }
      </div>
    );
  }
}

export default Card;
