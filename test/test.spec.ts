/**
 * Test
 */

import test from 'ava'
import * as IO from 'socket.io'
import * as Socket from 'socket.io-client'
import {
  MockSocket,
} from '../src/mocksocket'
import p from 'fourdollar.promisify'

const io = IO(8110)
const mock = new MockSocket(io.of('mock'))

test.after(() => {
  io.close()
})

test.cb('namespace is /mock', t => {
  const socket = Socket('http://localhost:8110/mock')
  let connected = false
  socket.on('connect', () => {
    connected = true
  })
  socket.on('message', msg => {
    t.is(connected, true)
    t.is(msg, 'Hello in mock')
    t.end()
    socket.close()
  })
})

test.cb('echo to each socket', t => {
  const socket = Socket('http://localhost:8110/mock')
  socket.on('connect', () => {
    socket.emit(':echo', 'Hello World!!')
  })
  socket.on(':echo', (...args) => {
    t.deepEqual(args, ['Hello World!!'])
    socket.close()
    t.end()
  })
})

test.cb('ack', t => {
  const socket = Socket('http://localhost:8110/mock')
  socket.emit(':ack', 'Hello World!!', (err: Error, msg: string) => {
    if(err) {
      console.log(err.message)
      t.fail()
    } else {
      t.is(msg, 'Hello World!!')
    }
    socket.close()
    t.end()
  })
})

test.cb('ack > async', t => {
  const socket = Socket('http://localhost:8110/mock')
  socket.emit(':ack.async', 'Hello World!!', (err: Error, msg: string) => {
    if(err) {
      t.fail()
    } else {
      t.is(msg, 'Hello World!!')
    }
    socket.close()
    t.end()
  })
})

test('ack > async', async t => {
  const socket = Socket('http://localhost:8110/mock')
  const msg = await p(socket.emit, socket)(':ack', 'Hello World!!')
  t.is(msg, 'Hello World!!')
  socket.close()
})

test.cb('auth > on and off level01', t => {
  const socket = Socket('http://localhost:8110/mock', {
    transportOptions: {
      polling: {
        extraHeaders: {
          token: 'level01'
        },
      },
    },
  })
  socket.emit(':auth.level01', 'on', async (err: Error, msg: string) => {
    if(err) {
      console.log(err.message)
      t.fail()
      socket.close()
      t.end()
    } else {
      t.is(msg, 'ok')
      const level01Room = mock.namespace.in('level01')
      const clients: string[] = await p(level01Room.clients, level01Room)()
      t.not(clients.indexOf(socket.id), -1)
      socket.on(':auth.level01', res => {
        t.is(res, 'level01')
        socket.emit(':auth.level01', 'off', async (err: Error, msg: string) => {
          if(err) {
            console.log(err.message)
            t.fail()
          } else {
            t.is(msg, 'ok')
            const level01Room = mock.namespace.in('level01')
            const clients: string[] = await p(level01Room.clients, level01Room)()
            t.is(clients.indexOf(socket.id), -1)
          }
          socket.close()
          t.end()
        })
      })
    }
  })
})

test.cb('auth > on and off level02', t => {
  const socket = Socket('http://localhost:8110/mock', {
    transportOptions: {
      polling: {
        extraHeaders: {
          token: 'level02'
        },
      },
    },
  })
  socket.emit(':auth.level01', 'on', async (err: Error, msg: string) => {
    if(err) {
      console.log(err.message)
      t.fail()
    } else {
      t.is(msg, 'ok')
      const level01Room = mock.namespace.in('level01')
      const clients: string[] = await p(level01Room.clients, level01Room)()
      t.not(clients.indexOf(socket.id), -1)
    }
  })
  socket.emit(':auth.level02', 'on', async (err: Error, msg: string) => {
    if(err) {
      console.log(err.message)
      t.fail()
    } else {
      t.is(msg, 'ok')
      const level02Room = mock.namespace.in('level02')
      const clients: string[] = await p(level02Room.clients, level02Room)()
      t.not(clients.indexOf(socket.id), -1)
    }
  })
  let receivedLevel01 = true
  let receivedLevel02 = true
  socket.on(':auth.level01', res => {
    t.is(res, 'level01')
    socket.emit(':auth.level01', 'off', async (err: Error, msg: string) => {
      if(err) {
        console.log(err.message)
        t.fail()
      } else {
        t.is(msg, 'ok')
        const level01Room = mock.namespace.in('level01')
        const clients: string[] = await p(level01Room.clients, level01Room)()
        t.is(clients.indexOf(socket.id), -1)
        if(receivedLevel01 = true && receivedLevel02) {
          socket.close()
          t.end()
        }
      }
    })
  })
  socket.on(':auth.level02', res => {
    t.is(res, 'level02')
    socket.emit(':auth.level02', 'off', async (err: Error, msg: string) => {
      if(err) {
        console.log(err.message)
        t.fail()
      } else {
        t.is(msg, 'ok')
        const level02Room = mock.namespace.in('level02')
        const clients: string[] = await p(level02Room.clients, level02Room)()
        t.is(clients.indexOf(socket.id), -1)
        if(receivedLevel02 = true && receivedLevel01) {
          socket.close()
          t.end()
        }
      }
    })
  })
})

test.cb('@Use > order', t => {
  const socket = Socket('http://localhost:8110/mock')
  socket.emit(':use.order', (err: Error, ...track: string[]) => {
    if(err) {
      t.fail()
    } else {
      t.deepEqual(track, [ 'use00', 'use01', 'use02', 'use03', 'use04', 'use05' ])
    }
    socket.close()
    t.end()
  })
})

test.cb('error > in @Use()', t => {
  const socket = Socket('http://localhost:8110/mock', {
    transportOptions: {
      polling: {
        extraHeaders: {
          token: 'bed token',
        },
      },
    },
  })
  socket.on('error', (err: string) => {
    t.is(err, 'bed token')
    socket.close()
    t.end()
  })
})

test.cb('error > in @On()', t => {
  const socket = Socket('http://localhost:8110/mock')
  socket.emit(':ack', 'error', (err: Error, msg: string) => {
    if(err) {
      t.is(err.message, 'error')
    } else {
      t.fail()
    }
    socket.close()
    t.end()
  })
})

test.cb('error > in @On() async', t => {
  const socket = Socket('http://localhost:8110/mock')
  socket.emit(':ack.async', 'error', (err: Error, msg: string) => {
    if(err) {
      t.is(err.message, 'error')
    } else {
      t.fail()
    }
    socket.close()
    t.end()
  })
})

test.cb('error > not found', t => {
  const socket = Socket('http://localhost:8110/mock')
  socket.emit(':notfound', 'error', (err: Error, msg: string) => {
    if(err) {
      t.is(err.message, 'not found event')
    } else {
      t.fail()
    }
    socket.close()
    t.end()
  })
})
