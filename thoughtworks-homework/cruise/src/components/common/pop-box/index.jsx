/**
 * Components - PopBox
 */
import React, { Component } from 'react';
import './index.css';

class PopBox extends Component {
  render () {
    const { visible, children } = this.props;
    console.log('visible: ', visible)
    return (
      <div
        className='pop-box-wrap'
        style={{
          display: visible ? 'block' : 'none' // 可以后面用class来管理 两套class切换 加入渐变动画
        }}
      >
        这就是PopBox
        内容:
        { children }
      </div>
    );
  }
}

export default PopBox;