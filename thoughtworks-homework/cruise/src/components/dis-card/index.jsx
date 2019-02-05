/**
 * components-业务型组件-DisCard
 * 1- DisplayCard - 用来作为展示用的Card组件 继承自公用组件Card
 * 2- 其他业务型的卡片由此继承
 * 3- 除了定制backgroundColor 和 padding外 还有：同业务一致的内部布局 父组件只管专注于数据即可
 */
import React, { Component } from 'react';
import Card from '../common/card';
import { Row, Col } from '../common/grid';
import './index.css';

/**
 * DisCard
 */
class DisCard extends Component {
  render() {
    const {
      backColor,
      padding,
      title,
      data
    } = this.props; 
    return (
      <Card
        backColor={backColor}
        padding={padding || '10px 5px'}
        style={{
          height: '120px'
        }}
      >
        <Row>
          <Col className='title-wrap' span={8} offset={1}>
            { title }
          </Col>
        </Row>
        <Row>
          <Col className='data-wrap' span={3} offset={21}>
            { data }
          </Col>
        </Row>
      </Card>
    );
  }
}

export default DisCard;
