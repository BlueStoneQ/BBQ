/**
 * components-Input
 * 1- Input输入组件： 包括Input 和 继承自Input的Search
 */
import React, { Component } from 'react';
import './index.css';

/**
 * Input
 */
class Input extends Component {
  render() { 
    return (
      <input
        className='input-wrap'
      />
    );
  }
}

export default Input;
