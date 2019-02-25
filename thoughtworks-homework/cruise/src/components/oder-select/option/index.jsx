/**
 * OrderSelect - 业务型组件
 * 1- 定制化的下拉框
 * 2- 纯手工实现 没有使用input.type=select
 * 3- 使用的是点击下拉开关时的鼠标指针位置 来计算出下拉框的位置
 * 4- 也许可以抽象到公共组件库中
 */
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { toggleDrop } from '../../../redux/actions/order-select';
import './index.css'

class Option extends Component {
  /**
   * OPtion点击事件
   */
  onClick = () => {
    // 触发isDropDown状态
    const { onToggleDrop, onOptionClick } = this.props;
    onToggleDrop();
    // 执行点击回调
    onOptionClick && onOptionClick();
  }
  render () {
    const {
      children
    } = this.props;
    return (
      <span className='option-wrap' onClick={this.onClick}>
        { children }
      </span>
    );
  }
}

const mapStateToProps = state => {
  return {
    isDropDown: state.orderSelect.isDropDown
  };  
}

const mapDispatchToProps = dispatch => {
  return {
    onToggleDrop: () => {
      dispatch(toggleDrop()); 
    }
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Option);