import {
  On,
  Use,
  OnConnect,
  OnDisconnect,
  Socket,
  Middleware,
  SocketWrapper,
  Namespace,
} from './index'
import * as cf from './config'
import {
  LogSpace,
} from './log.space'
import {
  JwtConfig,
  DecodedToken,
} from './interface'
import * as jwt from 'jsonwebtoken'


/**
 * status code 와 함께 Error 객체
 */

export class ErrorWithStatusCode extends Error {
  constructor(message: string, public status: number = 500) {
    super(message)
  }
}

export class ErrorBadRequest extends ErrorWithStatusCode {
  constructor(msg?: string) {
    (msg)? super(`Bad Request: ${msg}`, 400) : super('Bad Request', 400)
  }
}

export class ErrorUnauthorized extends ErrorWithStatusCode {
  constructor(msg?: string) {
    (msg)? super(`Unauthorized: ${msg}`, 401) : super('Unauthorized', 401)
  }
}

export class ErrorNotFound extends ErrorWithStatusCode {
  constructor(msg?: string) {
    (msg)? super(`Not Found: ${msg}`, 404) : super('Not Found', 404)
  }
}


export const OnWrapped = On.next(async (socket, args, next) => {
  try {
    await next()
  } catch(err) {
    const ack = args[args.length -1]
    if(typeof ack === 'function') {
      ack(sendingErrorData(err))
    }
  }
}).next(async (socket, args, next) => {
  const res = await next()
  const ack = args[args.length - 1]
  if(typeof ack === 'function') {
    ack(null, res)
  }
}).on()

export function sendingErrorData(err: ErrorWithStatusCode): {
  message: string
  name: string
  stack: string
  status: number
} {
  return {
    message: err.message,
    name: err.name,
    stack: err.stack,
    status: err.status || 500
  }
}


function _decodeToken(token: string, config: JwtConfig): DecodedToken {
  try {
    // create a promise that decodes the token
    const decoded: DecodedToken = jwt.verify(token, config.secret) as DecodedToken
    if(decoded.iss !== config.options.issuer 
      || decoded.sub !== config.options.subject) {
        throw new Error('The wrong token.')
    }
    let now = Date.now()
    now = (now - now % 1000) / 1000
    if(!(now >= decoded.iat && now <= decoded.exp)) {
      throw new Error('The authentication has expired.')
    }
    decoded.permissions || (decoded.permissions = [])
    decoded.permissions.map(p => p.toLowerCase())
    return decoded
  } catch(err) {
    // if it has failed to verify, it will return an error message
    throw new ErrorUnauthorized(err.message)
  } 
}

export function decodeToken(config: JwtConfig): Middleware {
  return (socket, next, ctx) => {
    try {
      const token = socket.handshake.headers['x-access-token'] || socket.handshake.query.token
      if(token) {
        socket['_decoded'] = _decodeToken(token, config)
      }
      next()
    } catch(err) {
      next(err)
    }
  }
}

export function getDecodedToken(socket: Socket): DecodedToken {
  return socket['_decoded']
}


function found(target: any[], searchElement: any) {
  return target.indexOf(searchElement) !== -1
}

function level(level: string): SocketWrapper {
  return (socket, args, next) => {
    try {
      const permissions = getDecodedToken(socket).permissions
      switch(level) {
        case 'level01': {
          if(found(permissions, 'level01') || found(permissions, 'level02')) {
            break
          }
        }
        case 'level02': {
          if(found(permissions, 'level02')) {
            break
          }
        }
        default: {
          throw new ErrorUnauthorized('denied')
        }
      }
    } catch(err) {
      throw new ErrorUnauthorized('denied')
    }
    return next()
  }
}

const OnLevel01 = OnWrapped.next(level('level01')).on()
const OnLevel02 = OnWrapped.next(level('level02')).on()

function track(socket: Socket, index: string) {
  const track: string[]= socket['track'] || []
  track.push(index)
  socket['track'] = track
}

// use는 socket이 처음 connect 될때만 한번 실행 된다.
@Use(0, (socket, next, ctx) => {
  track(socket, 'use00')
  next()
})

@Use((socket, next, ctx) => {
  // track
  track(socket, 'use04')
  decodeToken(cf.jwtConfig)(socket, next, ctx)
})

@Use((socket, next, ctx) => {
  track(socket, 'use03')
  next()
})

export class MockSpace extends LogSpace {
  sayHello = 'Hello in mock'

  constructor(namespace: Namespace) {
    super(namespace)
    setInterval(() => {
      this.to('level01').emit(':auth.level01', 'level01')
    }, 200)
    setInterval(() => {
      this.to('level02').emit(':auth.level02', 'level02')
    }, 200)
  }

  @OnConnect()
  onConnect(socket: Socket) {
    socket.send(this.sayHello)
  }

  @Use()
  use01(socket: Socket, next: (err?: Error) => void, ctx: MockSpace) {
    track(socket, 'use01')
    next()
  }

  @Use()
  use02(socket: Socket, next: (err?: Error) => void, ctx: MockSpace) {
    track(socket, 'use02')
    next()
  }

  @Use(101)
  use03(socket: Socket, next: (err?: Error) => void, ctx: MockSpace) {
    track(socket, 'use05')
    next()
  }

  @On(':echo')
  echo(socket: Socket, ...args: any[]) {
    socket.emit(':echo', ...args)
  }

  @OnWrapped(':ack')
  ack(socket: Socket, echo: string) {
    if(echo === 'error') {
      throw new Error('error')
    }
    return echo
  }

  @OnWrapped(':ack.async')
  async asyncAck(socket: Socket, echo: string) {
    const res = await mockAsync(echo)
    return res[0]
  }

  @On(':use.order')
  order(socket: Socket, ack: (err: Error, ...track: string[]) => void) {
    return ack(null, ...socket['track'])
  }

  @OnLevel01(':auth.level01')
  allowLevel01(socket: Socket, onoff: string) {
    switch(onoff) {
      case 'on': {
        socket.join('level01')
        return 'ok'
      }
      case 'off': {
        socket.leave('level01')
        return 'ok'
      }
      default: {
        throw new ErrorBadRequest('bad query')
      }
    }
  }

  @OnLevel02(':auth.level02')
  allowLevel02(socket: Socket, onoff: string) {
    this.allowLevel01(socket, onoff)
    switch(onoff) {
      case 'on': {
        socket.join('level02')
        return 'ok'
      }
      case 'off': {
        socket.leave('level02')
        return 'ok'
      }
      default: {
        throw new ErrorBadRequest('bad query')
      }
    }
  }

  @OnWrapped('*')
  notFound() {
    throw new ErrorNotFound('not found event')
  }
}

function mockAsync(...args: any[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    process.nextTick((...args: any[]) => {
      if(args[0] === 'error') {
        reject(new Error('error'))
        return
      }
      resolve(args)
    }, ...args)
  })
}