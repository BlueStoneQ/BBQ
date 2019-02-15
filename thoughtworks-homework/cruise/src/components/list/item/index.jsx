/**
 * component - List.Item
 * 1- List的Item部分
 * 2- 后续加入Dialog或者model之类的
 * 3- 业务型/展示型组件
 */
import React, { Component } from 'react';
import { Row, Col, Img } from '../../index';
import './index.css';

const colStyle = {
  border: '1px solid #f00'
};

/**
 * data中的os和对应图片名称的映射关系
 * key: os
 * value: img的名称
 */
const os2img = {
  windows: 'windows',
  ubuntu: 'ubuntu',
  debian: 'debin',
  suse: 'suse',
  centos: 'cent_os'
};

class Button extends Component {
  render () {
    const { data } = this.props;
    const {
      name,
      status,
      os,
      ip,
      location,
      resources
    } = data;
    return (
       <Row className='ls-item-wrap'>
        <Col span={2} offset={0.5} style={{...colStyle}}>
          <Img
            imgUrl={`/assets/os-icons/${os2img[os]}.png`}
            width='80px'
            height='80px'
            backSize='100%'
            />
        </Col>
        <Col span={20}>
          <Row>
            <Col span={8} style={{...colStyle}}>{ name }</Col>
            <Col span={4} style={{...colStyle}}>{ status }</Col>
            <Col span={6} style={{...colStyle}}>{ ip }</Col>
            <Col span={6} style={{...colStyle}}>{ location }</Col>
          </Row>
          <Row>
            <Col span={2} style={{...colStyle}}>btn</Col>
            {
              resources.map((v, i) => (
                <Col key={i} span={3} style={{...colStyle}}>{ v }</Col>
              ))
            }
            <Col span={2} style={{...colStyle}}>Deny</Col>
          </Row>
        </Col>
       </Row>
    );
  }
}

export default Button