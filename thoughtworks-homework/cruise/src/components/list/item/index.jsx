/**
 * component - List.Item
 * 1- List的Item部分
 * 2- 后续加入Dialog或者model之类的
 * 3- 业务型组件
 */
import React, { Component } from 'react';
import { Row, Col } from '../../index';
import './index.css';

class Button extends Component {
  render () {
    return (
       <Row className='item-wrap'>
        <Col span={4}>类型图片</Col>
        <Col span={4}>
          <Row>
            <Col span={8}>网址</Col>
            <Col span={4}>idle</Col>
            <Col span={6}>ip</Col>
            <Col span={6}>地址</Col>
          </Row>
        </Col>
       </Row>
    );
  }
}

export default Button