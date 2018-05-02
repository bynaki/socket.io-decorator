import {
  Server,
  Namespace,
  Socket,
} from 'socket.io'


export {Server, Namespace, Socket}
export type Middleware = (socket: Socket, next: (err?: Error) => void, ctx?: BaseNamespace) => Promise<void>|void
export type SocketWrapper = (socket: Socket, args: any[], next: () => Promise<void>|void) => Promise<void>|void


export class BaseNamespace {
  private _useList: {callback: Middleware|string, index: number}[]
  private _onList: {event: string, callback: string , wrappers?: SocketWrapper[]}[] 
  private _onconnectionList: string[]

  constructor(readonly namespace: Namespace) {
    // init uses
    this._useList || (this._useList = [])
    this._useList.sort((a, b) => {
      return a.index - b.index
    }).forEach(use => {
      const callback: Middleware = (typeof use.callback === 'function')
        ? use.callback : this[use.callback].bind(this)
      namespace.use((socket, next) => callback(socket, next, this))
    })

    // init each socket
    this._onList || (this._onList = [])
    this.namespace.on('connect', socket => {
      this._onList.forEach(on => {
        const callback: (socket: Socket, ...args: any[]) => Promise<any>|any = this[on.callback].bind(this)
        if(on.wrappers.length !== 0) {
          socket.on(on.event, (...args) => {
            const kingWrapper = on.wrappers.reduce(
              (next, wrapper) => (() => wrapper(socket, args, next as any))
              , () => callback(socket, ...args))
            return (kingWrapper as any)()
          })
        } else {
          socket.on(on.event, (...args) => callback(socket, ...args))
        }
      })
      socket['use']((packet: any[], next: (err?: Error) => void) => {
        const event = packet[0]
        if(event) {
          packet[0] = (socket.eventNames().indexOf(event) === -1)? '*' : event
        }
        next()
      })
    })

    // init onconnection
    this._onconnectionList || (this._onconnectionList = [])
    this._onconnectionList.forEach(callback => {
      this.namespace.on('connect', this[callback].bind(this))
    })
  }

  emit(event: string|symbol, ...args: any[]): boolean {
    return this.namespace.emit(event, ...args)
  }

  send(...args: any[]) {
    return this.namespace.send(...args)
  }

  to(room: string) {
    this.namespace.to(room)
    return this
  }
  in = BaseNamespace.prototype.to
}

export function Use(): (target: any, name: string, descriptor: PropertyDescriptor) => void
export function Use(index: number): (target: any, name: string, descriptor: PropertyDescriptor) => void
export function Use(middleware: Middleware): (target: any) => void
export function Use(index: number, middleware: Middleware): (target: any) => void
export function Use(a?, b?) {
  if(typeof a !== 'number') {
    b = a
    a = 100
  }
  if(typeof b === 'function') {
    return (target: any) => {
      target.prototype._useList || (target.prototype._useList = [])
      target.prototype._useList.push({callback: b, index: a})
    }
  } else {
    return (target: any, name: string, descriptor: PropertyDescriptor) => {
      target._useList || (target._useList = [])
      target._useList.push({callback: name, index: a})
    }
  }
}


export class Wrapper {
  constructor(private _wraps: SocketWrapper[] = []) {
  }

  next(wrapper: SocketWrapper) {
    const newWraps = [wrapper, ...this._wraps]
    return new Wrapper(newWraps)
  }

  on(): {
    (event: string): (target: any, callback: string, descriptor: PropertyDescriptor) => void
    next: (wrapper: SocketWrapper) => Wrapper
  } {
    const on = (event: string) => {
      return (target: any, callback: string, descriptor: PropertyDescriptor) => {
        target._onList = target._onList || []
        target._onList.push({
          event,
          callback,
          wrappers: this._wraps
        })
      }
    }
    on['next'] = this.next.bind(this)
    return on as any
  }
}

export const On = new Wrapper().on()

export function OnConnection() {
  return (target: any, name: string, descriptor: PropertyDescriptor) => {
    target._onconnectionList || (target._onconnectionList = [])
    target._onconnectionList.push(name)
  }
}
