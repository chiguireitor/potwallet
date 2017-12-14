import React from 'react'
import { Button, Menu, Icon, Label, Dropdown, Image, Modal, Header, Step, Segment, Form, Input, Select, Table, Statistic, Grid, Message } from 'semantic-ui-react'

import { Actions, Settings, Transactions, Ticker, fetchPrice, fetchAddr, estimatedFeePerTransaction } from './wallet'

import logo from './logo.png'
import coin from './coin.png'

function beautifyNumber(x) {
  return Math.round(x * 100)/100
}

export default class MainMenu extends React.Component {
  constructor() {
    super()

    this.state = {
      checkoutModalOpen: false,
      checkoutStep: 0,
      gotPriceData: false,
      gotBalanceData: false
    }

  }

  componentDidMount() {

  }

  openCheckoutModal = () => {
    this.setState({
      checkoutModalOpen: true,
      checkoutStep: 0,
      canBuy: false
    })
  }

  closeCheckoutModal = () => {
    this.setState({
      checkoutModalOpen: false
    })
  }

  nextStepModal = () => {
    let nextStep = this.state.checkoutStep + 1
    if (nextStep > 3) {
      this.setState({
        checkoutModalOpen: false
      })
    } else {
      this.setState({
        checkoutStep: nextStep
      })
    }
  }

  prevStepModal = () => {
    let nextStep = this.state.checkoutStep - 1
    this.setState({
      checkoutStep: nextStep
    })
  }

  render() {
    let {
      checkoutModalOpen,
      checkoutStep
    } = this.state

    let basket
    let checkoutButton = ""
    if (this.props.basket.length === 0) {
      basket = <Dropdown.Item><Icon name="frown"/> Empty Basket</Dropdown.Item>
    } else {
      let total = 0
      basket = this.props.basket.map((x, i) => {
        total += x.price * x.amount
        return (<Dropdown.Item key={i}>
          <Image src={x.image} height="32px"/> x{x.amount} {x.name} - ${x.price * x.amount}
        </Dropdown.Item>)
      })
      basket.push(<Dropdown.Item key="total">Total ${total}</Dropdown.Item>)
      checkoutButton = (<Dropdown.Item><Button color="green" onClick={this.openCheckoutModal}>Checkout</Button></Dropdown.Item>)
    }

    let activeSegment
    if (this.state.checkoutStep === 0) {
      let options = [
        {key: "mr", text: "Mr", value: "Mr"},
        {key: "ms", text: "Ms", value: "Ms"},
        {key: "mrs", text: "Mrs", value: "mrs"}
      ]
      activeSegment = (<Segment inverted attached="top">
        <Form inverted>
          <Form.Group widths='equal'>
            <Form.Field control={Input} label='First name' placeholder='First name' />
            <Form.Field control={Input} label='Last name' placeholder='Last name' />
            <Form.Field control={Select} label='Treatment' options={options} placeholder='Mr/Ms/Mrs' />
          </Form.Group>

          <Form.Group widths='equal'>
            <Form.Field control={Input} label='Email' placeholder='Email' />
            <Form.Field control={Input} label='Phone No.' placeholder='Phone No.' />
          </Form.Group>
          <Form.Field control={Input} label='Address line 1' placeholder='Address line 1' />
          <Form.Field control={Input} label='Address line 2' placeholder='Address line 2' />

          <Form.Group widths='equal'>
            <Form.Field control={Input} label='City' placeholder='City' />
            <Form.Field control={Input} label='State' placeholder='State' />
          </Form.Group>

          <Form.Checkbox label='I agree to the disclose my address to third party vendors' />
          <Form.Checkbox label='Remember my address for the next time' />
        </Form>
      </Segment>)
    } else if (this.state.checkoutStep === 1) {
      let shipping = 15
      let totalBilled = this.props.basket.reduce((p, itm) => itm.price * itm.amount + p, 0) + shipping

      activeSegment = (<Segment inverted attached="top">
      <Table celled padded inverted>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Item</Table.HeaderCell>
            <Table.HeaderCell>Quantity</Table.HeaderCell>
            <Table.HeaderCell>Price</Table.HeaderCell>
            <Table.HeaderCell>Subtotal</Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
        { this.props.basket.map((itm) => {
            return (<Table.Row>
              <Table.Cell>{itm.name}</Table.Cell>
              <Table.Cell>{itm.amount}</Table.Cell>
              <Table.Cell>${itm.price}</Table.Cell>
              <Table.Cell>${itm.price * itm.amount}</Table.Cell>
            </Table.Row>)
          })
        }

          <Table.Row>
            <Table.Cell></Table.Cell>
            <Table.Cell></Table.Cell>
            <Table.Cell>Shipping</Table.Cell>
            <Table.Cell>${shipping}</Table.Cell>
          </Table.Row>

          <Table.Row>
            <Table.Cell></Table.Cell>
            <Table.Cell></Table.Cell>
            <Table.Cell>Total</Table.Cell>
            <Table.Cell>${totalBilled}</Table.Cell>
          </Table.Row>

        </Table.Body>
      </Table>
      </Segment>)
    } else if (this.state.checkoutStep === 2) {
      let shipping = 15
      let totalBilled = this.props.basket.reduce((p, itm) => itm.price * itm.amount + p, 0) + shipping

      if (!this.state.gotPriceData) {
        fetchPrice((err, data) => {
          let ob = {
            price: data[0].price_usd,
            gotPriceData: true
          }

          if (this.state.gotBalanceData) {
            ob.canBuy = (totalBilled / data[0].price_usd) < (this.state.balance - estimatedFeePerTransaction())
          }

          this.setState(ob)
        })
      }

      if (!this.state.gotBalanceData) {
        fetchAddr((err, data) => {
          let ob = {
            balance: data.balance,
            gotBalanceData: true
          }

          if (this.state.gotPriceData) {
            ob.canBuy = (totalBilled / this.state.price) < (data.balance - estimatedFeePerTransaction())
          }

          this.setState(ob)
        })
      }

      activeSegment = (<Segment inverted attached="top" loading={!this.state.gotPriceData}>
        <Header>Confirm your order</Header>
        <Grid textAlign="center" padded="vertically">
          <Statistic inverted>
            <Statistic.Value>
              <Image src={coin} inline circular />
              {(this.state.gotPriceData)?beautifyNumber(totalBilled/this.state.price) + " POT":"Loading"}
            </Statistic.Value>
            <Statistic.Label>Fiat total ${totalBilled}</Statistic.Label>
          </Statistic>

          <div>
          {(!this.state.canBuy)?<Message negative inverted>
            <Message.Header>You don't have enough balance</Message.Header>
            <p>Deposit coins to your account using the <Icon name="money"/> menu.</p>
            </Message>:""}
            </div>
        </Grid>
      </Segment>)
    } else if (this.state.checkoutStep === 3) {
      activeSegment = (<Segment inverted attached="top" textAlign="center">
      <Icon name="check circle" size="massive" color="green"/>
      <p><strong>You're done!</strong></p>
      </Segment>)
    }

    let cancelButton = ""
    if (checkoutStep === 0) {
      cancelButton = (<Button color='red' inverted onClick={this.closeCheckoutModal}>
        <Icon name='cancel'/> Cancel
      </Button>)
    } else if (checkoutStep < 3) {
      cancelButton = (<Button color='red' inverted onClick={this.prevStepModal}>
        <Icon name='chevron left'/> Back
      </Button>)
    }

    let nextButton = ""
    if (checkoutStep === 2) {
      nextButton = (<span>
        {(!this.state.canBuy)?<Button color='yellow' inverted onClick={this.closeCheckoutModal}>Close</Button>:""}
        <Button color='blue' inverted onClick={this.nextStepModal} disabled={!this.state.canBuy}>
          Confirm <Icon name='check'/>
        </Button></span>)
    } else if (checkoutStep < 3) {
      nextButton = (<Button color='green' inverted onClick={this.nextStepModal}>
        Next <Icon name='chevron right'/>
      </Button>)
    } else {
      nextButton = (<Button color='green' inverted onClick={this.nextStepModal}>
        Close <Icon name='check'/>
      </Button>)
    }

    return (
      <Menu fixed="top" size="large">
       <Menu.Item>
        <Image src={logo} height="32px"/>
       </Menu.Item>
       <Menu.Item>
         <Ticker />
       </Menu.Item>

       <Dropdown item icon='shopping basket' simple floating labeled label={{color: "red", circular: true}} text={"" + this.props.basket.length}>
         <Dropdown.Menu>

          {basket}
          {checkoutButton}

          <Modal basic size='small' open={checkoutModalOpen}>
            <Header icon='shopping basket' content='Complete your order' />
            <Modal.Content>
              {activeSegment}

              <Step.Group attached="bottom" widths={3}>
                <Step active={checkoutStep === 0} completed={checkoutStep > 0}>
                  <Icon name='truck' />
                  <Step.Content>
                    <Step.Title>Shipping</Step.Title>
                    <Step.Description>Specify your shipping address</Step.Description>
                  </Step.Content>
                </Step>

                <Step active={checkoutStep === 1} disabled={checkoutStep < 1} completed={checkoutStep > 1}>
                  <Icon name='payment' />
                  <Step.Content>
                    <Step.Title>Billing</Step.Title>
                    <Step.Description>Check billing information</Step.Description>
                  </Step.Content>
                </Step>

                <Step active={checkoutStep === 2} disabled={checkoutStep < 2} completed={checkoutStep > 2}>
                  <Icon name='info' />
                  <Step.Content>
                    <Step.Title>Confirm Order</Step.Title>
                  </Step.Content>
                </Step>
              </Step.Group>

            </Modal.Content>
            <Modal.Actions>
              {cancelButton}
              {nextButton}
            </Modal.Actions>
          </Modal>
         </Dropdown.Menu>
       </Dropdown>

       <Transactions />

       <Actions />

       <Settings />
       <Menu.Item>
         <Label>This wallet is alpha quality, please don't deposit big amounts as anything could change</Label>
       </Menu.Item>
     </Menu>
   )
 }
}
