/**
 * 业务型组件 - 点击+会显示的对话框
 * 1- 把业务内容装到组件ConfigBox中
 * 2- 把父组件的ref等信息传给ConfigBox
 */
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { toggleVisible } from '../../redux/actions/pop-box';
import PopBox from '../common/pop-box';
import './index.css';

class ConfigBox extends Component {
  render () {
    const { popBoxVisible, onToggleVisible } = this.props;
    console.log('popBoxVisible: ', popBoxVisible)
    return (
      <PopBox visible={popBoxVisible}>
        欢迎进入ConfigBox：
        <span onClick={() => { onToggleVisible() }}>
          点击我
        </span>
      </PopBox>
    );
  }
}

const mapStateToProps = state => {
  return {
    popBoxVisible: state.popBox.visible
  };
}

const mapDispatchToProps = dispatch => {
  return {
    onToggleVisible: () => {
      console.log('开始dispatch')
      dispatch(toggleVisible());
    }
  };
}


export default connect(mapStateToProps, mapDispatchToProps)(ConfigBox);