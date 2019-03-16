import {
  MockSpace,
} from './mock'


const port = process.env.PORT || 8110
const io = require('socket.io')(port, {
  path: '/v1',
})
var mock = new MockSpace(io.of('mock'))

console.log(`Socket.IO Server is listening on ${port}`)