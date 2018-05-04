import {
  BaseNamespace,
  On,
  Use,
  OnConnect,
  Middleware,
  SocketWrapper,
  Socket,
  OnDisconnect,
} from './'


function level(level: string): SocketWrapper {
  return (socket, args, next) => {
    switch(level) {
      case 'level01': {
        if(socket['token'] === 'level01' || socket['token'] === 'level02') {
          break
        }
      }
      case 'level02': {
        if(socket['token'] === 'level02') {
          break
        }
      }
      default: {
        throw new Error('denied')
      }
    }
    return next()
  }
}

const OnWrapped = On.next(async (socket, args, next) => {
  try {
    await next()
  } catch(e) {
    const ack = args[args.length - 1]
    if(typeof ack === 'function') {
      const err: Error = e
      ack({
        message: err.message,
        name: err.name,
        stack: err.stack,
      })
    }
  }
}).next(async (socket, args, next) => {
  const res = await next()
  const ack = args[args.length - 1]
  if(typeof ack === 'function') {
    ack(null, res)
  }
}).on()
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
  const token = socket.handshake.headers['token'] || []
  if(token === 'bad token') {
    next(new Error('bad token'))
    return
  }
  socket['token'] = token
  // track
  track(socket, 'use04')
  next()
})
@Use((socket, next, ctx) => {
  track(socket, 'use03')
  next()
})

@OnConnect((socket, ctx: MockSocket) => {
  socket.send(ctx.sayHello2)
})
export class MockSocket extends BaseNamespace {
  sayHello = 'Hello in mock'
  sayHello2 = 'Hello again'

  constructor(namespace) {
    super(namespace)
    setInterval(() => {
      this.to('level01').emit(':auth.level01', 'level01')
    }, 200)
    setInterval(() => {
      this.to('level02').emit(':auth.level02', 'level02')
    }, 200)
  }

  @OnConnect()
  onConnect(socket: Socket, ctx: MockSocket) {
    socket.send(this.sayHello)
  }

  @OnDisconnect()
  OnDisconnect(reason: string, socketId: string, ctx: MockSocket) {
    console.log('reason: ', reason, socketId)
  }

  @Use()
  use01(socket: Socket, next: (err?: Error) => void, ctx: MockSocket) {
    track(socket, 'use01')
    next()
  }

  @Use()
  use02(socket: Socket, next: (err?: Error) => void, ctx: MockSocket) {
    track(socket, 'use02')
    next()
  }

  @Use(101)
  use03(socket: Socket, next: (err?: Error) => void, ctx: MockSocket) {
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
        throw new Error('bed query')
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
        throw new Error('bed query')
      }
    }
  }

  @OnWrapped('*')
  notFound() {
    throw new Error('not found event')
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