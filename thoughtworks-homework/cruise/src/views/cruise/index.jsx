/**
 * cruise -main Page
 */
import React, { Component } from 'react';
import {
  Page,
  Row,
  Col,
  Menu,
  Layout,
  Icon
} from '../../components';
// import logo from '../../assets/logo/avatar.jpg';
import './index.css';

const { Header, Content, Sider, Footer } = Layout;

/**
 * Row的公共样式
 */
const rowStyle = {};

/**
 * Col的公共样式
 */
const colStyle = {};

class Cruise extends Component {
  render() {
    return (
      <Layout>
        <Header>
          <Row style={{...rowStyle}}>
            <Col span={4} offset={10} style={{...colStyle}}>
              <Icon
                imgUrl='/assets/logo/logo.svg'
                width='150px'
                height='50px'
                backSize='80%'
              />
            </Col>
            <Col span={4} offset={6} style={{...colStyle}}>
              <Icon
                imgUrl='/assets/logo/avatar.jpg'
                width='40px'
                height='40px'
                backSize='100%'
                borderRadius='50%'
              />
            </Col>
          </Row>
        </Header>
        <Sider>Sider</Sider>
        <Content width='120px'>Content</Content>
        <Footer>Footer</Footer>
      </Layout>
    );
  }
}

export default Cruise;
