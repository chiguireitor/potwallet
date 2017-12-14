import React from 'react'
import { Button, Container, Icon, Label, Image, Grid } from 'semantic-ui-react'

import Item from './item'

export default class Store extends React.Component {
  constructor() {
    super()
  }

  componentDidMount() {

  }

  _addToBasket = (itm) => {
    if (this.props.onAddToBasket) {
      this.props.onAddToBasket(itm)
    }
  }

  render() {
    return (
    <Container style={{ marginTop: '7em' }}>

       <Grid columns={3}>
        <Grid.Row>
          <Grid.Column>
            <Item
              image="https://www.motacannabisproducts.ca/wp-content/uploads/2017/10/sourbelt3-600x600.jpg"
              name="Sour Belts"
              added="2017"
              price="17"
              description="A delicious sour chewable!"
              id="sour-belts"
              onAddToBasket={this._addToBasket}
              />
          </Grid.Column>
          <Grid.Column>
            <Item
              image="https://www.motacannabisproducts.ca/wp-content/uploads/2016/06/chocolateloversbrownie-600x600.jpg"
              name="Chocolate lovers Brownie"
              added="2017"
              price="13"
              description="A delicious brownie with a good hit!"
              id="brownies"
              onAddToBasket={this._addToBasket}
              />
          </Grid.Column>
          <Grid.Column>
            <Item
              image="https://www.motacannabisproducts.ca/wp-content/uploads/2017/05/dweebs-1-600x600.jpg"
              name="Dweebs"
              added="2017"
              price="13"
              description="Yummy candy to get high"
              id="dweebs"
              onAddToBasket={this._addToBasket}
              />
          </Grid.Column>
        </Grid.Row>
      </Grid>
     </Container>
    )
  }
}
