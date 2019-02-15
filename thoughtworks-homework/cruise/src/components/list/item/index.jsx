/**
 * component - List.Item
 * 1- List的Item部分
 * 2- 后续加入Dialog或者model之类的
 * 3- 业务型组件
 */
import React, { Component } from 'react';
import { Row, Col } from '../../index';
import './index.css';

const colStyle = {
  border: '1px solid #f00'
};

class Button extends Component {
  render () {
    const { data } = this.props;
    const {
      name,
      os,
      ip,
      location,
    } = data;
    return (
       <Row className='ls-item-wrap'>
        <Col span={4} style={{...colStyle}}>类型图片</Col>
        <Col span={20}>
          <Row>
            <Col span={8} style={{...colStyle}}>{ name }</Col>
            <Col span={4} style={{...colStyle}}>idle</Col>
            <Col span={6} style={{...colStyle}}>{ ip }</Col>
            <Col span={6} style={{...colStyle}}>{ location }</Col>
          </Row>
          <Row>
            <Col span={8} style={{...colStyle}}>{ name }</Col>
            <Col span={4} style={{...colStyle}}>idle</Col>
            <Col span={6} style={{...colStyle}}>{ ip }</Col>
            <Col span={6} style={{...colStyle}}>{ location }</Col>
          </Row>
        </Col>
       </Row>
    );
  }
}

export default Button