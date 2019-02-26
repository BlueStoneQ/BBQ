/**
 * components-Input
 * 1- Input输入组件： 包括Input 和 继承自Input的Search
 */
import React, { Component } from 'react';
import classNames from 'classnames';
import './index.css';

/**
 * Input
 */
class Input extends Component {
  render() { 
    const { className, style } = this.props;
    return (
      <input
        className={classNames('input-wrap', className)}
        style={{...style}}
      />
    );
  }
}

export default Input;
