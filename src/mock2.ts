import {
  On,
  OnConnect,
  Socket,
} from '.'
import { LogSpace } from './log.space';
import {
  OnWrapped,
  ErrorWithStatusCode,
} from './mock'


export class Mock2Space extends LogSpace {
  sayHello = 'Hello in mock2'
  sayHello2 = 'Hello mock2 again'

  constructor(namespace) {
    super(namespace)
  }

  @OnConnect()
  onConnect(socket: Socket, ctx: Mock2Space) {
    socket.send(this.sayHello)
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
}
