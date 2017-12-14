import React from 'react'
import { Button, Container, Header, Menu, Icon, Label, Dropdown, Image, Grid } from 'semantic-ui-react'

import Item from './item'
import MainMenu from './mainmenu'
import Store from './store'
import 'styles/index.scss'
import logo from './logo.png'
import coin from './coin.png'

const BIP44_NETWORK_DERIVE_CODE = 81

export default class App extends React.Component {
  constructor() {
    super()

    this.state = {
      basket: []
    }
  }

  componentDidMount() {

  }

  _addToBasket = (itm) => {
    let arr = this.state.basket
    let prevItem = arr.find((x) => x.id == itm.id)

    if (prevItem) {
      prevItem.amount += 1
    } else {
      itm.amount = 1
      arr.push(itm)
    }

    this.setState({
      basket: arr
    })
  }

  render() {
    let {
      basket
    } = this.state

    return (
      <div>
        <MainMenu basket={basket}/>
        <Store onAddToBasket={this._addToBasket}/>
      </div>
    )
  }
}
