import {
  OnConnect,
  OnDisconnect,
  Socket,
  SocketWrapper,
  Namespace,
  On,
  BaseNamespace
} from './index'
import Logger from 'fourdollar.logger'


// Logger.writer.link = new FileWriter(join(__dirname, 'log/access.log'), '1d')
Logger.format = ':time: > [:name:] :msg:'

// export default Logger
// export const logger = new Logger('Internal')

export class LogSpace extends BaseNamespace {
  private _l: Logger

  constructor(namespace: Namespace) {
    super(namespace)
    this._l = new Logger(namespace.name)
  }

  log(...msgs: string[]) {
    this._l.log(...msgs)
  }

  error(...msgs: string[]) {
    this._l.error(msgs)
  }

  @OnConnect()
  onConnected(socket: Socket) {
    this.log(`a socket(${socket.id}) connected`)
  }

  @OnDisconnect()
  onDisconnected(reason: string, socketId: string) {
    this.log(`a socket(${socketId}) disconnected: `, reason)
  }

  @OnConnect()
  triggerEvent(socket: Socket) {
    socket['use']((packet: any[], next: (err?: Error) => void) => {
      this.log(`emited event in the socket(${socket.id}): '${packet[0]}'`)
      next()
    })
  }

  @On('error')
  onError(socket: Socket, err: Error) {
    this.error(`error in a socket(${socket.id}): `, err.message)
  }
}