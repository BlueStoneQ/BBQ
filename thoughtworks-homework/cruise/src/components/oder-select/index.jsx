/**
 * OrderSelect - 业务型组件
 * 1- 定制化的下拉框
 * 2- 纯手工实现 没有使用input.type=select
 * 3- 使用的是点击下拉开关时的鼠标指针位置 来计算出下拉框的位置
 * 4- 也许可以抽象到公共组件库中
 */
import React, { Component } from 'react'
import { Icon } from '../index'
import './index.css'

class Option extends Component {
  render () {
    const {
      children
    } = this.props
    return (
      <span>
        { children }
      </span>
    )
  }
}

class OrderSelect extends Component {
  constructor (props) {
    super(props)
    this.state = {
      isDropDown: false
    };
  }
  /**
   * 点击开关
   */
  onDrop = () => {
    this.setState({
      isDropDown: !this.state.isDropDown
    });
  }
  render () {
    const {
      isDropDown
    } = this.state
    return (
      <span
        className='or-select-switch'
        onClick={ this.onDrop }
      >
        <Icon type={ isDropDown ? 'angle-down' : 'angle-up' } />
      </span>
    )
  }
}

export default OrderSelect