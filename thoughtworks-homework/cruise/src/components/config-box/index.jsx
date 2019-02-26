/**
 * 业务型组件 - 点击+会显示的对话框
 * 1- 把业务内容装到组件ConfigBox中
 * 2- 把父组件的ref等信息传给ConfigBox
 */
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { toggleVisible } from '../../redux/actions/pop-box';
import {
  PopBox,
  Row,
  Col,
  Icon,
  Input,
  Button
} from '../index';
import './index.css';

/**
 * Row的公共样式
 */
const rowStyle = {
  marginBottom: '8px',
  border: '1px solid #0f0'
};

/**
 * Col的公共样式
 */
const colStyle = {
  border: '1px solid #00f'
};

class ConfigBox extends Component {
  render () {
    const { popBoxVisible, onToggleVisible } = this.props;
    console.log('popBoxVisible: ', popBoxVisible)
    return (
      <PopBox
        visible={popBoxVisible}
        className='config-box-wrap'
      >
        <Row style={{...rowStyle}}>
          <Col span={1} offset={23}>
            <Icon type='close' />
          </Col>
        </Row>
        <Row style={{...rowStyle}}>
          separate multiple resource name with commas
        </Row>
        <Row style={{...rowStyle}}>
          <Col span={24}>
            <Input />
          </Col>
        </Row>
        <Row style={{...rowStyle}}>
          <Col span={5}>
            <Button type='primary'>
              Add Resource
            </Button>
          </Col>
          <Col span={5} offset={1}>
            <Button type='dark'>
              Cancel
            </Button>
          </Col>
        </Row>
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