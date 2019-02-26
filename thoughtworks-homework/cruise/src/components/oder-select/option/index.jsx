/**
 * OrderSelect.Option
 * 1- 定制化的下拉框中的选项
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