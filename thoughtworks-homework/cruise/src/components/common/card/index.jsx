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
    const {
      backColor,
      padding
    } = this.props; 
    return (
      <div
        className='card-wrap'
        style={{
          background: backColor,
          padding: padding 
        }}
      >
        { this.props.children }
      </div>
    );
  }
}

export default Card;
