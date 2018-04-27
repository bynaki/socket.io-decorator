import {
  BaseNamespace,
  On,
  Use,
  OnConnection,
  NamespaceMiddleware,
  Socket,
  SocketWrapper,
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
    next()
  }
}

const errorWrapper = On.wrap(async (socket, args, next) => {
  const ack = (typeof args[args.length - 1] === 'function')? args[args.length - 1] : null
  try {
    await next()
    // ack && ack('ok')
  } catch(err) {
    ack && ack('error: ' + err.message)
  }
})

const OnWrapped = errorWrapper.on()
const OnLevel01 = errorWrapper.next(level('level01')).on()
const OnLevel02 = errorWrapper.next(level('level02')).on()

function track(socket: Socket, index: string) {
  const track: string[]= socket['track'] || []
  track.push(index)
  socket['track'] = track
}


@Use(0, (socket, next, ctx) => {
  track(socket, 'use00')
  next()
})
// use는 socket이 처음 connect 될때만 한번 실행 된다.
@Use((socket, next, ctx) => {
  const token = socket.handshake.headers['token'] || []
  if(token === 'bed token') {
    next(new Error('error: bed token'))
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
export class MockSocket extends BaseNamespace {
  sayHello = 'Hello in mock'
  constructor(namespace) {
    super(namespace)
    setInterval(() => {
      this.to('level01').emit(':auth.level01', 'level01')
    }, 200)
    setInterval(() => {
      this.to('level02').emit(':auth.level02', 'level02')
    }, 200)
  }

  @OnConnection()
  onConnect(socket: Socket) {
    socket.send(this.sayHello)
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
  ack(socket: Socket, echo: string, ack: (echo: string) => void) {
    if(echo === 'error') {
      throw new Error('error')
    }
    ack(echo)
  }

  @OnWrapped(':ack.async')
  async asyncAck(socket: Socket, echo: string, ack: (echo: string) => void) {
    const res = await mockAsync(echo)
    ack(res[0])
  }

  @On(':use.order')
  order(socket: Socket, ack: (...track: string[]) => void) {
    return ack(...socket['track'])
  }

  @OnLevel01(':auth.level01')
  allowLevel01(socket: Socket, onoff: string, ack?: (msg: string) => void) {
    switch(onoff) {
      case 'on': {
        socket.join('level01')
        ack && ack('ok')
        break
      }
      case 'off': {
        socket.leave('level01')
        ack && ack('ok')
        break
      }
      default: {
        throw new Error('bed query')
      }
    }
  }

  @OnLevel02(':auth.level02')
  allowLevel02(socket: Socket, onoff: string, ack?: (msg: string) => void) {
    this.allowLevel01(socket, onoff)
    switch(onoff) {
      case 'on': {
        socket.join('level02')
        ack && ack('ok')
        break
      }
      case 'off': {
        socket.leave('level02')
        ack && ack('ok')
        break
      }
      default: {
        throw new Error('bed query')
      }
    }
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