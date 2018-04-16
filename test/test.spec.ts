/**
 * Test
 */

import test from 'ava'
import MockSocket from '../src/mocksocket'
import * as IO from 'socket.io'
import * as Socket from 'socket.io-client'
import * as stop from 'stop.js'
import {
  sign,
} from 'jsonwebtoken'
import cf from '../src/config'


const io = IO(8110)

io.on('connection', socket => {
  new MockSocket(socket)
})

test.after(() => {
  io.close()
})

test.cb('connecting', t => {
  const socket = Socket('http://localhost:8110')
  let connected = false
  socket.on('connect', () => {
    connected = true
  })
  socket.on('message', data => {
    t.true(connected)
    t.is(data, 'I am a MockSocket.')
    t.end()
    socket.close()
  })
  socket.on('error', err => {
    t.fail()
  })
})

test.cb('echo', t => {
  const socket = Socket('http://localhost:8110')
  socket.on(':echo', (...args: any[]) => {
    t.deepEqual(args, ['Hello', 'World'])
    t.end()
    socket.close()
  })
  socket.emit(':echo', 'Hello', 'World')
})

test.cb.serial('for anti garbage collection', t => {
  const socket = Socket('http://localhost:8110')
  socket.on('connect', () => {
    t.is(MockSocket.socketList.length, 1)
    const observer = Socket('http://localhost:8110')
    observer.on('connect', () => {
      t.is(MockSocket.socketList.length, 2)
      socket.close()
    })
    observer.on(':disconnect', reason => {
      t.is(MockSocket.socketList.length, 1)
      t.is(reason, 'client namespace disconnect')
      t.end()
      observer.close()
    })
  })
})

test.cb('use order and this.', t => {
  const socket = Socket('http://localhost:8110')
  socket.on('connect', () => {
    socket.emit(':using-order')
  })
  socket.on(':using-order', (...args: number[]) => {
    t.deepEqual(args, [0, 1, 2, 3])
    t.end()
    socket.close()
  })
})

test.cb('use index', t => {
  const socket = Socket('http://localhost:8110')
  socket.on('connect', () => {
    socket.emit(':using-index')
  })
  socket.on(':using-index', (...args: number[]) => {
    t.deepEqual(args, [0, 1, 2, 3])
    t.end()
    socket.close()
  })
})

test.cb('@On(event, before)', t => {
  const socket = Socket('http://localhost:8110')
  socket.on('connect', () => {
    socket.emit(':before01', 'foobar')
  })
  socket.on(':before01', (arg01, arg02) => {
    t.is(arg01, 'foobar')
    t.is(arg02, 'before01')
    t.end()
    socket.close()
  })
})

test.cb('@On(event, before) > before method of this', t => {
  const socket = Socket('http://localhost:8110')
  socket.on('connect', () => {
    socket.emit(':before02', 'foobar')
  })
  socket.on(':before02', (arg01, arg02) => {
    t.is(arg01, 'foobar')
    t.is(arg02, 'before say hello')
    t.end()
    socket.close()
  })
})

// async가 아닐때와 async일때 순서가 다르다
test.cb('@On(event, before) > befores with no async', t => {
  const socket = Socket('http://localhost:8110')
  socket.on('connect', () => {
    socket.emit(':before03')
  })
  let order = 0
  socket.on(':before03.1', () => {
    console.log(':before03.1')
    t.is(++order, 1)
  })
  socket.on(':before03.2', () => {
    console.log(':before03.2')
    t.is(++order, 2)
  })
  socket.on(':before03.3', () => {
    console.log(':before03.3')
    t.is(++order, 3)
  })
  socket.on(':before03.4', () => {
    console.log(':before03.4')
    t.is(++order, 4)
  })
  socket.on(':before03', (...args: number[]) => {
    console.log(':before03')
    t.deepEqual(args, [1, 2, 3, 4, 5])
    t.end()
    socket.close()
  })
})

// async가 아닐때와 async일때 순서가 다르다
test.cb('@On(event, before) > befores with async', t => {
  const socket = Socket('http://localhost:8110')
  socket.on('connect', () => {
    socket.emit(':before04')
  })
  let order = 0
  socket.on(':before04.1', () => {
    console.log(':before04.1')
    t.is(++order, 1)
  })
  socket.on(':before04.2', () => {
    console.log(':before04.2')
    t.is(++order, 2)
  })
  socket.on(':before04.3', () => {
    console.log(':before04.3')
    t.is(++order, 3)
  })
  socket.on(':before04.4', () => {
    console.log(':before04.4')
    t.is(++order, 4)
    t.end()
    socket.close()
  })
  socket.on(':before04', (...args: number[]) => {
    console.log(':before04')
    t.deepEqual(args, [1, 2, 3])
  })
})

test.cb('error > local error', t => {
  const socket = Socket('http://localhost:8110')
  socket.on('connect', () => {
    socket.emit('error', 'local error')
  })
  socket.on('error', err => {
    t.is(err, 'local error')
    t.end()
    socket.close()
  })
})

test.cb('error > through next() in @Use()', t => {
  const socket = Socket('http://localhost:8110')
  socket.on('connect', () => {
    socket.emit(':error.use')
  })
  socket.on('error', err => {
    t.is(err, 'this is error through next() in @Use()')
    t.end()
    socket.close()
  })
})

test.cb('error > through next() in before() in @On(event, before)', t => {
  const socket = Socket('http://localhost:8110')
  socket.on('connect', () => {
    socket.emit(':error.before')
  })
  socket.on('error', err => {
    t.is(err, 'this is error through next() in before() in @On(event, before)')
    t.end()
    socket.close()
  })
  socket.on(':error.before', msg => {
    t.fail()
    t.end()
    socket.close()
  })
})

test.cb('error > @On()의 에러는 서버의 "error" 이벤트로만 전달되고 이것을 외부로 전달하려면 따로 이벤트를 emit해야 한다.', t => {
  const socket = Socket('http://localhost:8110')
  socket.on('connect', () => {
    socket.emit(':error.on')
  })
  socket.on(':error', err => {
    t.is(err, 'this is error in @On')
    t.end()
    socket.close()
  })
})

test.cb('query', t => {
  const socket = Socket('http://localhost:8110?password=this%20is%20my%20password&id=foobar')
  socket.on('connect', () => {
    socket.emit(':query')
  })
  socket.on(':query', (password, id) => {
    t.is(password, 'this is my password')
    t.is(id, 'foobar')
    t.end()
    socket.close()
  })
})

test.cb('header', t => {
  const socket = Socket('http://localhost:8110', {
    transportOptions: {
      polling: {
        extraHeaders: {
          'token': 'this is my token',
        },
      },
    },
  })
  socket.on('connect', () => {
    socket.emit(':header')
  })
  socket.on(':header', token => {
    t.is(token, 'this is my token')
    t.end()
    socket.close()
  })
})

test.cb('auth > only read', t => {
  const socket = Socket('http://localhost:8110', {
    transportOptions: {
      polling: {
        extraHeaders: {
          'x-access-token': sign({read: true, write: false}
            , cf.jwt.secret, cf.jwt.options),
        },
      },
    },
  })
  socket.on('connect', () => {
    socket.emit(':auth.read')
  })
  socket.on(':auth.read', res => {
    t.is(res, 'OK')
    t.end()
    socket.close()
  })
})

test.cb('auth > write too', t => {
  const socket = Socket('http://localhost:8110', {
    transportOptions: {
      polling: {
        extraHeaders: {
          'x-access-token': sign({read: true, write: true}
            , cf.jwt.secret, cf.jwt.options),
        },
      },
    },
  })
  socket.on('connect', () => {
    socket.emit(':auth.write')
  })
  socket.on(':auth.write', res => {
    t.is(res, 'OK')
    t.end()
    socket.close()
  })
})

test.cb('auth > deny', t => {
  const socket = Socket('http://localhost:8110', {
    transportOptions: {
      polling: {
        extraHeaders: {
          'x-access-token': sign({read: true, write: false}
            , cf.jwt.secret, cf.jwt.options),
        },
      },
    },
  })
  socket.on('connect', () => {
    socket.emit(':auth.write')
  })
  socket.on('error', err => {
    t.is(err, 'Unauthorized: denied')
    t.end()
    socket.close()
  })
  socket.on(':auth.write', res => {
    t.fail()
    t.end()
    socket.close()
  })
})

test.cb('auth > malformed', t => {
  const socket = Socket('http://localhost:8110', {
    transportOptions: {
      polling: {
        extraHeaders: {
          'x-access-token': 'bad token',
        },
      },
    },
  })
  socket.on('connect', () => {
    socket.emit(':auth.write')
  })
  socket.on('error', err => {
    t.is(err, 'Unauthorized: jwt malformed')
    t.end()
    socket.close()
  })
  socket.on(':auth.write', res => {
    t.fail()
    t.end()
    socket.close()
  })
})
