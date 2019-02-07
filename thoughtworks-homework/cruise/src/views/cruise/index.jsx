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
  Card,
  Tabs,
  Input
} from '../../components';
// import logo from '../../assets/logo/avatar.jpg';
import './index.css';

const { Header, Content, Sider, Footer } = Layout;
const MenuItem = Menu.Item;
const TabPane = Tabs.TabPane;

/**
 * Row的公共样式
 */
const rowStyle = {
  marginBottom: '10px',
  // border: '1px solid #0f0'
};

/**
 * Col的公共样式
 */
const colStyle = {
  // border: '1px solid #00f'
};

class Cruise extends Component {
  /**
   * 渲染Tabs中的extra
   */
  getTabsExtraRender = () => {
    return (
      <Row>
        <Col
          span={20}
          style={{
            paddingLeft: '30px'
          }}
        >
          <Input />
        </Col>
        <Col span={4}>2</Col>
      </Row>
    );
  }
  render() {
    return (
      <Layout>
        <Header>
          <Row
            className='h-row'
            style={{...rowStyle}}
          >
            <Col
              span={4}
              offset={10}
              className='h-col'
              style={{...colStyle}}
            >
              <Icon
                imgUrl='/assets/logo/logo.svg'
                width='150px'
                height='50px'
                backSize='100%'
              />
            </Col>
            <Col
              span={3}
              offset={7}
              className='h-col'
              style={{...colStyle}}
            >
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
        <Content>
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
                 <Card
                  className='num-card'
                >
                  <Row className='num-card-label'>
                    <Col span={8}>ALL</Col>
                    <Col span={8}>PHYSICAL</Col>
                    <Col span={8}>VIRTUAL</Col>
                  </Row>
                  <Row className='num-card-num'>
                    <Col span={8}>8</Col>
                    <Col span={8}>4</Col>
                    <Col span={8}>4</Col>
                  </Row>
                </Card>
              </Col>
            </Row>
            <Row style={{...rowStyle}}>
              <Col span={24} style={{...colStyle}}>
                <Tabs
                  tabsWidth={8}
                  extra={this.getTabsExtraRender()}
                >
                  <TabPane tab='All' key='All'>1</TabPane>
                  <TabPane tab='Physical' key='Physical'>2</TabPane>
                  <TabPane tab='Virtual' key='Virtual'>3</TabPane>
                </Tabs>
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
