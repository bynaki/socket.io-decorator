import * as IO from 'socket.io'
import {
  MockSpace,
} from './mock'


const port = 8110
const io = IO(port)
const mock = new MockSpace(io.of('mock'))