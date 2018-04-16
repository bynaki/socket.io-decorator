/**
 * MockSocket
 */

import * as stop from 'stop.js'
import {
  BaseSocket,
  On,
  Use,
  Middleware,
} from './'
import * as jwt from 'jsonwebtoken'
import cf from '../src/config'


function auth(certified = {}): Middleware {
  const valids = Object.keys(certified).filter(key => certified[key])
  return (packet, next, ctx: MockSocket) => {
    if(typeof ctx.decoded === 'string') {
      next(new Error('Unauthorized: ' + ctx.decoded))
      return
    }
    const truly = valids.every(v => ctx.decoded[v])
    if(truly) {
      next()
    } else {
      next(new Error('Unauthorized: denied'))
    }
  }
}

@Use(-1, (packet, next) => {
  if(packet[0] === ':using-index') {
    packet.push(0)
  }
  next()
})
@Use((packet, next) => {
  if(packet[0] === ':using-index') {
    packet.push(2)
  }
  next()
})
@Use((packet, next) => {
  if(packet[0] === ':using-order') {
    packet.push(3)
  }
  next()
})
@Use((packet, next) => {
  if(packet[0] === ':using-order') {
    packet.push(2)
  }
  next()
})
export default class MockSocket extends BaseSocket {
  nth: number
  beforeMsg: string
  readonly decoded: any

  constructor(socket) {
    super(socket)
    this.send('I am a MockSocket.')
    this.nth = 1
    this.beforeMsg = 'before say hello'

    // read the token from header of url
    const token = this.handshake.headers['x-access-token'] || this.handshake.query.token
    // token does not exist
    if(!token) {
      return
    }
    try {
      // create a promise that decodes the token
      const decoded = jwt.verify(token, cf.jwt.secret)
      if(decoded.iss !== cf.jwt.options.issuer 
        || decoded.sub !== cf.jwt.options.subject) {
          throw new Error('The wrong token.')
      }
      let now = Date.now()
      now = (now - now % 1000) / 1000
      if (!(now >= decoded.iat && now <= decoded.exp)) {
        throw new Error('The authentication has expired.')
      }
      this.decoded = decoded
    } catch(err) {
      // if it has failed to verify, it will return an error message
      this.decoded = err.message
      // throw new Error('Unauthorized: ' + err.message)
    } 
  }

  // get decoded() {
  //   return this._decoded
  // }

  @Use()
  use01(packet: any[], next: (err?: Error) => void) {
    if(packet[0] === ':using-order') {
      packet.push(0)
    }
    next()
  }

  @Use()
  use02(packet: any[], next: (err?: Error) => void) {
    if(packet[0] === ':using-order') {
      packet.push(this.nth)  // 1
    }
    next()
  }

  @Use(101)
  use03(packet: any[], next: (err?: Error) => void) {
    if(packet[0] === ':using-index') {
      packet.push(3)
    }
    next()
  }

  @Use(10)
  use04(packet: any[], next: (err?: Error) => void) {
    if(packet[0] === ':using-index') {
      packet.push(this.nth)  // 1
    }
    next()
  }

  @On(':echo')
  hello(...args: any[]) {
    this.emit(':echo', ...args)
  }

  @On('disconnect')
  disconnect(reason) {
    MockSocket.socketList.forEach(socket => {
      socket.emit(':disconnect', reason)
    })
  }

  @On(':using-order')
  usingOrder(...args: any[]) {
    this.emit(':using-order', ...args)
  }

  @On(':using-index')
  usingIndex(...args: any[]) {
    this.emit(':using-index', ...args)
  }

  @On(':before01', (packet, next) => {
    packet.push('before01')
    next()
  })
  after01(...args: any[]) {
    this.emit(':before01', ...args)
  }

  @On(':before02', 'before02')
  after02(...args: any[]) {
    this.emit(':before02', ...args)
  }

  before02(packet: any[], next: (err?: Error) => void) {
    packet.push(this.beforeMsg)
    next()
  }

  @On(':before03', (packet, next, ctx) => {
    packet.push(1)
    ctx.emit(':before03.1')
    next()
    packet.push(4)
    ctx.emit(':before03.4')
  }, async (packet, next, ctx) => {
    packet.push(2)
    ctx.emit(':before03.2')
    next()
    packet.push(3)
    ctx.emit(':before03.3')
  })
  after03(...args: any[]) {
    args.push(5)
    this.emit(':before03', ...args)
  }

  @On(':before04', async (packet, next, ctx) => {
    await stop(500)
    packet.push(1)
    ctx.emit(':before04.1')
    await next()
    packet.push(5)
    ctx.emit(':before04.4')
  }, async (packet, next, ctx) => {
    await stop(200)
    packet.push(2)
    ctx.emit(':before04.2')
    await next()
    await stop(100)
    packet.push(4)
    ctx.emit(':before04.3')
  })
  after04(...args: any[]) {
    args.push(3)
    this.emit(':before04', ...args)
  }

  @Use()
  errorUse(packet: any[], next: (err?: Error) => void) {
    if(packet[0] === ':error.use') {
      next(new Error('this is error through next() in @Use()'))
      return
    }
    next()
  }

  @Use()
  errorUse2(packet: any[], next: (err?: Error) => void) {
    if(packet[0] === ':error.use2') {
      // 매우 위험하다.
      throw new Error('this is error to be threw in @Use()')
    }
    next()
  }

  @On(':error.before', (packet, next) => {
    next(new Error('this is error through next() in before() in @On(event, before)'))
  })
  errorBefore(...args: any[]) {
    this.emit(':error.before', 'it must not be able to see this')
  }

  @On(':error.on')
  errorOn() {
    throw new Error('this is error in @On')
  }

  @On('error')
  error(err) {
    this.emit(':error', err.message)
  }

  @On(':query', (packet, next, ctx) => {
    packet.push(ctx.handshake.query.password)
    packet.push(ctx.handshake.query.id)
    next()
  })
  query(...args: any[]) {
    this.emit(':query', ...args)
  }

  @On(':header', (packet, next, ctx) => {
    packet.push(ctx.handshake.headers.token)
    next()
  })
  header(...args: any[]) {
    this.emit(':header', ...args)
  }

  @On(':auth.read', auth({read: true, write: false}))
  authRead(...args: any[]) {
    this.emit(':auth.read', 'OK')
  }

  @On(':auth.write', auth({read: true, write: true}))
  authWrite(...args: any[]) {
    this.emit(':auth.write', 'OK')
  }
}