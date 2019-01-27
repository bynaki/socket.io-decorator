import * as IO from 'socket.io'
import {
  MockSocket,
} from './mocksocket'


const port = 8110
const io = IO(port)
const mock = new MockSocket(io.of('mock'))