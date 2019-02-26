/**
 * 业务型组件 - 点击+会显示的对话框
 * 1- 把业务内容装到组件ConfigBox中
 * 2- 把父组件的ref等信息传给ConfigBox
 */
import React, { Component } from 'react';
import PopBox from '../common/pop-box';
import './index.css';

class ConfigBox extends Component {
  render () {
    const { visible, children } = this.props;
    return (
      <PopBox>
        欢迎进入ConfigBox：
      </PopBox>
    );
  }
}

export default ConfigBox;