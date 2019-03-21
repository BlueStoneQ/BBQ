/**
 * Components - PopBox
 */
import React, { Component } from 'react';
import classNames from 'classnames';
import './index.css';

class PopBox extends Component {
  render () {
    const { visible, children, className, width } = this.props;
    return (
      <div
        className={classNames('pop-box-wrap', className)}
        style={{
          display: visible ? 'block' : 'none', // 可以后面用class来管理 两套class切换 加入渐变动画
          width: width
        }}
      >
        { children }
      </div>
    );
  }
}

export default PopBox;