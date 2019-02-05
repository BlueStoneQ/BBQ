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
  Icon,
  DisCard,
  Card
} from '../../components';
// import logo from '../../assets/logo/avatar.jpg';
import './index.css';

const { Header, Content, Sider, Footer } = Layout;
const MenuItem = Menu.Item;

/**
 * Row的公共样式
 */
const rowStyle = {
  marginBottom: '10px',
  border: '1px solid #0f0'
};

/**
 * Col的公共样式
 */
const colStyle = {
  border: '1px solid #00f'
};

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
            <Col span={3} offset={7} style={{...colStyle}}>
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
        <Sider>
          <Menu>
            <MenuItem>DASHBORDER</MenuItem>
            <MenuItem>AGENT</MenuItem>
            <MenuItem>MY CRUISE</MenuItem>
            <MenuItem>HELP</MenuItem>
          </Menu>
        </Sider>
        <Content width='120px'>
          <Page
            padding='10px 20px'
          >
            <Row style={{...rowStyle}}>
              <Col span={7.5} style={{...colStyle}}>
                <DisCard
                  backColor='#FF9A2A'
                  title='Building'
                  data='3'
                />
              </Col>
              <Col span={7.5} offset={0.5} style={{...colStyle}}>
                <DisCard
                  backColor='#7FBA39'
                  title='Idle'
                  data='5'
                />
              </Col>
              <Col span={8} offset={0.5} style={{...colStyle}}>
                <Card>
                  <Row>
                    <Col>12</Col>
                  </Row>
                </Card>
              </Col>
            </Row>
            <Row style={{...rowStyle}}>
              <Col span={8} style={{...colStyle}}>
                1
              </Col>
              <Col span={8} style={{...colStyle}}>
                1
              </Col>
              <Col span={8} style={{...colStyle}}>
                1
              </Col>
            </Row>
          </Page>
        </Content>
        <Footer>@Copyright 2017 ThoughtWorks</Footer>
      </Layout>
    );
  }
}

export default Cruise;
