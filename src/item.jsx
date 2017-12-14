import React from 'react'
import { Card, Icon, Image, Button } from 'semantic-ui-react'

export default class Item extends React.Component {
  constructor() {
    super()
  }

  _addToBasket = () => {
    if (this.props.onAddToBasket) {
      this.props.onAddToBasket({
        id: this.props.id,
        name: this.props.name,
        image: this.props.image,
        price: parseFloat(this.props.price)
      })
    }
  }

  render() {
    let {
      image,
      name,
      added,
      price,
      description,
      id
    } = this.props

    return (
    <Card raised>
      <Image src={image} />
      <Card.Content>
        <Card.Header>
          {name}
        </Card.Header>
        <Card.Meta>
          <span className='date'>
            Added in {added}
          </span>
        </Card.Meta>
        <Card.Description>
          {description}
        </Card.Description>
      </Card.Content>
      <Card.Content extra textAlign="center">
        <p>
          $ {price}
        </p>
        <small>Suggested retail price</small>
      </Card.Content>
      <Card.Content extra textAlign="center">
        <Button color="green" onClick={this._addToBasket}><Icon name="plus"/> Add to basket</Button>
      </Card.Content>
    </Card>
    )
  }
}
