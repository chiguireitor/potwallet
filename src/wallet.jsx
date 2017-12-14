import React from 'react'
import { Button, Menu, Icon, Label, Dropdown, Image, Modal, Header, Segment, Form, Input } from 'semantic-ui-react'
import QRCode from 'qrcode.react'
import bip39 from 'bip39'
import Aesjs from 'aes-js'
import bcrypt from 'bcryptjs'
import potcoin from 'potcoinjs-lib'
import axios from 'axios'
import copy from 'copy-to-clipboard'

import coin from './coin.png'

const BIP44_NETWORK_DERIVE_CODE = 81
const POTCHAIN_ENDPOINT = 'https://chain.potcoin.com/api/'
const CMC_POTCOIN_PRICE = 'https://api.coinmarketcap.com/v1/ticker/potcoin/'

var walletDetails = null
var walletDetailsObserver = []
var walletLoading = false

function watchWallet(fn) {
  if (walletDetails != null) {
    fn(walletDetails)
  }
  walletDetailsObserver.push(fn)

  if (!walletLoading) {
    loadWallet()
  }
}

function setWalletDetails(dets) {
  walletDetails = dets

  walletDetailsObserver.forEach((fn) => { fn(dets) })
}

function loadWallet() {
  walletLoading = true
  getReceivePrivkey((pk, wasEncrypted) => {
    let pa = pk.derive(0).getAddress()
    let addr = pa.toBase58Check()

    setWalletDetails({
      address: addr,
      encrypted: wasEncrypted
    })
  })
}

function decryptSeed(cbEncrypted, cb) {
  let seed = localStorage.getItem('seed')
  let isEncrypted = localStorage.getItem('isEncrypted') == 'yes'
  let wasEncrypted = false

  if (!seed) {
    seed = bip39.generateMnemonic()
    localStorage.setItem('seed', seed)

    cb(seed, wasEncrypted)
  } else {
    if (isEncrypted) {
      // decrypt
      wasEncrypted = true
      cbEncrypted(seed, (newSeed) => {
        cb(newSeed, wasEncrypted)
      })
    } else {
      cb(seed, wasEncrypted)
    }
  }
}

function getReceivePrivkey(cb) {
  decryptSeed(() => {
    throw new Error('Still can\'t decrypt stuff')
  }, (seed, wasEncrypted) => {
    let entropy = Buffer.from(bip39.mnemonicToSeedHex(seed), 'hex')
    let network = potcoin.networks.potcoin
    console.log(network)
    let hdnode = potcoin.HDNode.fromSeedBuffer(entropy, network)
    let baseAccount = hdnode.deriveHardened(44)
      .deriveHardened(BIP44_NETWORK_DERIVE_CODE)
      .deriveHardened(0)

    let receive = baseAccount.derive(0)

    cb(receive, wasEncrypted)
  })
}

var lastAddrData = null
var lastAddrDataTime = null
const ADDR_TIME_THRESHOLD = 15000 // 15 seconds
export function fetchAddr(addr, cb) {
  if (!lastAddrDataTime || ((Date.now() - lastAddrDataTime) > PRICE_TIME_THRESHOLD)) {
    axios({
      method: 'get',
      url: `${POTCHAIN_ENDPOINT}addr/${addr}`,
      responseType: 'json'
    }).then(data => {
      lastAddrData = data.data
      lastAddrDataTime = Date.now()
      cb(null, data.data)
    }).catch(err => {
      cb(err)
    })
  } else {
    setImmediate(() => {
      cb(null, lastAddrData)
    })
  }
}

export function fetchUtxos(addr, cb) {
  axios({
    method: 'get',
    url: `${POTCHAIN_ENDPOINT}addr/${addr}/utxo`,
    responseType: 'json'
  }).then(data => {
    cb(null, data.data)
  }).catch(err => {
    cb(err)
  })
}

var lastPriceData = null
var lastPriceDataTime = null
const PRICE_TIME_THRESHOLD = 350000 // 5 Minutes
export function fetchPrice(cb) {
  if (!lastPriceDataTime || ((Date.now() - lastPriceDataTime) > PRICE_TIME_THRESHOLD)) {
    axios({
      method: 'get',
      url: CMC_POTCOIN_PRICE,
      responseType: 'json'
    }).then(data => {
      lastPriceData = data.data
      lastPriceDataTime = Date.now()
      cb(null, data.data)
    }).catch(err => {
      cb(err)
    })
  } else {
    setImmediate(() => {
      cb(null, lastPriceData)
    })
  }
}

export function estimatedFeePerTransaction() {
  return 0.01
}

function broadcast(rawtx, cb) {
  axios({
    method: 'post',
    url: `${POTCHAIN_ENDPOINT}tx/send`,
    data: { rawtx },
    responseType: 'json'
  }).then(data => {
    cb(null, data.data)
  }).catch(err => {
    console.log('Broadcast error', err)
    cb(err)
  })
}

function toSatoshis(f) {
  return Math.round(f * 100000000)
}

function reverse(s) {
  return s.match(/[a-fA-F0-9]{2}/g).reverse().join('')
}

function buildSimpleSend({from, to, amount, feePerKb, pair, utxos}, cb) {
  let tx = new potcoin.TransactionBuilder(potcoin.networks.potcoin)

  let orderedUtxos = utxos.sort((a,b) => a.confirmations < b.confirmations)
  amount = toSatoshis(amount)
  feePerKb = toSatoshis(feePerKb)

  tx.addOutput(to, amount)

  function currentEstimatedFee() {
    return Math.round(tx.buildIncomplete().toHex().length * feePerKb / 2048)
  }

  amount += currentEstimatedFee()

  while ((orderedUtxos.length > 0) && (amount > 0)) {
    let prevFee = currentEstimatedFee()
    let utxo = orderedUtxos.shift()
    let utxoValue = toSatoshis(utxo.amount)

    if (utxoValue < prevFee) {
      continue // Skip dust utxos
    }

    tx.addInput(utxo.txid, utxo.vout)

    let newFee = currentEstimatedFee()
    let diffFee = newFee - prevFee

    if (diffFee < 0) {
      cb(new Error('Invalid fee change while adding output to transaction'))
      return
    } else {
      amount += diffFee - utxoValue
    }

    if (amount <= -newFee) {
      break // We can now build our transaction
    }
  }

  if (amount > 0) {
    cb(new Error('Can\'t build a valid transaction due to fees and small utxos'))
    return
  } else {
    amount += currentEstimatedFee()

    if (amount < 0) {
      // Change output... this breaks fee estimation aargh
      tx.addOutput(from, -amount)
    }
  }

  for (let i=0; i < tx.inputs.length; i++) {
    tx.sign(i, pair.privKey)
  }

  cb(null, tx.build().toHex())
}

class Actions extends React.Component {
  constructor() {
    super()

    this.state = {
      address: 'Loading wallet',
      balance: 0.0,
      sendDialogShown: false,
      sending: false
    }
  }

  componentDidMount() {
    watchWallet((details) => {
      this.setState({
        address: details.address
      })


      let fetch = () => {
        fetchAddr(details.address, (err, data) => {
          if (err) {
            this.setState({
              error: err
            })
          } else {
            this.setState({
              balance: data.balance,
              unconfirmedBalance: data.unconfirmedBalance
            })
          }
        })
      }
      setInterval(fetch, ADDR_TIME_THRESHOLD)
      setImmediate(fetch)
    })
  }

  onClickAddress = () => {
    copy(this.state.address)
  }

  showSendDialog = () => {
    this.setState({
      sendDialogShown: true,
      sending: false,
      sent: false
    })
  }

  hideSendDialog = () => {
    this.setState({
      sendDialogShown: false
    })
  }

  finishSendingFunds = () => {
    this.setState({
      sending: true
    })

    let {
      address,
      toAddress,
      toAmount
    } = this.state

    let handleError = (err) => {
      this.setState({
        sending: false,
        error: true,
        errorMessage: err
      })

      console.log('ERROR', err)
      console.trace()
    }

    console.log('Sending', toAmount, 'POT to', toAddress, 'from', address)
    getReceivePrivkey((pk) => {
      //potcoin
      fetchUtxos(address, (err, utxos) => {
        if (err) {
          handleError(err)
          return
        }
        buildSimpleSend({
          from: address,
          to: toAddress,
          amount: toAmount,
          feePerKb: estimatedFeePerTransaction(),
          pair: pk.derive(0),
          utxos
        }, (err, rawtx) => {
          if (err) {
            handleError(err)
            return
          }

          broadcast(rawtx, (err, data) => {
            if (err) {
              handleError(err)
              return
            }

            console.log(data)

            this.setState({
              sending: false,
              sendDialogShown: false,
              txid: data.txid,
              sent: true
            })
          })
        })
      })
    })
  }

  fillAmountWithMax = () => {
    this.setState({
      toAmount: this.state.balance
    })
  }

  handleChange = (event) => {
    const target = event.target
    const value = target.type === 'checkbox' ? target.checked : target.value
    const name = target.name

    this.setState({
      [name]: value
    })
  }

  handleSubmit = () => {
    this.finishSendingFunds()
  }

  render() {
    let {
      address,
      balance,
      sendDialogShown,
      sending,
      toAddress,
      toAmount
    } = this.state

    return (
      <Dropdown item icon='money' simple textAlign="center">
        <Dropdown.Menu>
         <Dropdown.Item><QRCode value={address} level="Q" size={256}/></Dropdown.Item>
         <Dropdown.Item onClick={this.onClickAddress}>{address}</Dropdown.Item>
         <Dropdown.Item onClick={this.showSendDialog}><Image src={coin}/> {balance}</Dropdown.Item>
         <Modal basic size='small' open={sendDialogShown}>
           <Header icon='send' content='Send Potcoin' />
           <Modal.Content>
            <Segment inverted loading={sending}>
               <Form inverted textAlign="center" onSubmit={this.handleSubmit}>
                 <Label as="a" onClick={this.fillAmountWithMax}>Available balance: {balance} POT</Label>
                 <Form.Group widths='equal'>
                   <Form.Input name='toAddress' value={toAddress} label='Address' placeholder='Address' onChange={this.handleChange} />
                   <Form.Input name='toAmount' value={toAmount} label='Amount' placeholder='Amount' onChange={this.handleChange} />
                 </Form.Group>
               </Form>
             </Segment>
           </Modal.Content>
           <Modal.Actions>
             <Button color='red' inverted onClick={this.hideSendDialog} disabled={sending}>
               <Icon name='cancel'/> Close
             </Button>

             <Button color='green' inverted onClick={this.finishSendingFunds} disabled={sending}>
               <Icon name='send'/> Send
             </Button>
           </Modal.Actions>
         </Modal>
        </Dropdown.Menu>
      </Dropdown>
    )
  }
}

class Settings extends React.Component {
  constructor() {
    super()

    this.state = {
      encrypted: false
    }
  }

  componentDidMount() {
    watchWallet((details) => {
      this.setState({
        encrypted: details.encrypted
      })
    })
  }

  openSeedModal = () => {
    decryptSeed(() => {
      throw new Error('Still can\'t decrypt seeds')
    }, (seed, wasEncrypted) => {
      this.setState({
        seed,
        seedModalOpen: true
      })
    })
  }

  closeSeedModal = () => {
    this.setState({
      seedModalOpen: false
    })
  }

  openResetModal = () => {
    decryptSeed(() => {
      throw new Error('Still can\'t decrypt seeds')
    }, (seed, wasEncrypted) => {
      this.setState({
        seed,
        resetModalOpen: true
      })
    })
  }

  closeResetModal = () => {
    this.setState({
      resetModalOpen: false
    })
  }

  handleChange = (event) => {
    const target = event.target
    const value = target.type === 'checkbox' ? target.checked : target.value
    const name = target.name

    this.setState({
      [name]: value
    })
  }

  scrambleSeed = () => {
    this.setState({
      seed: bip39.generateMnemonic()
    })
  }

  saveNewSeed = () => {
    localStorage.setItem('seed', this.state.seed)
    loadWallet()
    this.closeResetModal()
  }

  render() {
    let {
      encrypted,
      seed,
      seedModalOpen,
      resetModalOpen
    } = this.state

    /*
    <Dropdown.Item>TX Fee</Dropdown.Item>
    <Dropdown.Item>Sign Message</Dropdown.Item>
    <Dropdown.Divider />
    */

    return (
      <Dropdown item icon='settings' simple>
        <Dropdown.Menu>

          <Dropdown.Header>Wallet actions</Dropdown.Header>
          <Dropdown.Item onClick={this.openSeedModal}>Show passphrase</Dropdown.Item>
          <Modal basic size='small' open={seedModalOpen}>
            <Header icon='lemon' content='Wallet seed' />
            <Modal.Content>
              <p>Your seed unlocks your private keys, be sure to keep it safe and back it up in a safe place.</p>
              <Segment inverted textAlign="center">{seed}</Segment>
            </Modal.Content>
            <Modal.Actions>
              <Button color='green' inverted onClick={this.closeSeedModal}>
                <Icon name='checkmark'/> Close
              </Button>
            </Modal.Actions>
          </Modal>


          <Dropdown.Item disabled={encrypted}>Encrypt</Dropdown.Item>
          <Dropdown.Item onClick={this.openResetModal}>Reset</Dropdown.Item>
          <Modal basic size='small' open={resetModalOpen}>
            <Header icon='lemon' content='Reset wallet seed' />
            <Modal.Content>
              <p>Your seed unlocks your private keys, be sure to back it up in a safe place before resetting it, after that there will be no way to recover it.</p>
              <Segment inverted>
                 <Form inverted textAlign="center" onSubmit={this.saveNewSeed}>
                    <Form.Input inverted textAlign="center" name='seed' value={seed} label='Seed' placeholder='Seed' onChange={this.handleChange} />
                 </Form>
              </Segment>
            </Modal.Content>
            <Modal.Actions>
              <Button color='red' inverted onClick={this.closeResetModal}>
                <Icon name='cancel'/> Close
              </Button>

              <Button color='yellow' inverted onClick={this.scrambleSeed}>
                <Icon name='checkmark'/> New random seed
              </Button>

              <Button color='green' inverted onClick={this.saveNewSeed}>
                <Icon name='save'/> Save
              </Button>

            </Modal.Actions>
          </Modal>

        </Dropdown.Menu>
      </Dropdown>
    )
  }
}

class Transactions extends React.Component {
  constructor() {
    super()
  }

  componentDidMount() {
    watchWallet((details) => {
      this.setState({})
    })
  }

  render() {
    return (
      <Dropdown item icon='exchange' simple>
       <Dropdown.Menu>
         <Dropdown.Item><Icon name="frown"/> No transactions</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    )
  }
}

class Ticker extends React.Component {
  constructor() {
    super()

    this.state = {
      price: 0
    }
  }

  componentDidMount() {
    fetchPrice((err, data) => {
      if (err) {
        this.setState({
          error: err
        })
      } else {
        this.setState({
          price: data[0].price_usd
        })
      }
    })
  }

  render() {
    let {
      price
    } = this.state

    return (
      <Label as='a' color='teal' image>
        1 POT =
        <Label.Detail>{price} USD</Label.Detail>
      </Label>
    )
  }
}

export { Actions, Settings, Transactions, Ticker }
