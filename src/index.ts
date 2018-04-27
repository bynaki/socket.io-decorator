import {
  Server,
  Namespace,
  Socket,
} from 'socket.io'


export {Server, Namespace, Socket}
export type NamespaceMiddleware = (socket: Socket, next: (err?: Error) => void, ctx?: BaseNamespace) => Promise<void>|void
// export type SocketMiddleware = (packet: any[], next: (err?: Error) => void, ctx?: Socket) => Promise<void>|void
// export type SocketHandler = (socket: Socket, ...args: any[]) => Promise<void>|void
export type SocketWrapper = (socket: Socket, args: any[], next: () => Promise<void>|void) => Promise<void>|void

export class BaseNamespace {
  private _useList: {callback: NamespaceMiddleware|string, index: number}[]
  private _onList: {event: string, callback: string , wrappers?: SocketWrapper[]}[] 
  // private _preBefores: {[index: string]: SocketMiddleware[]}
  // private _befores: {[index: string]: SocketMiddleware}
  private _onconnectionList: string[]

  constructor(readonly namespace: Namespace) {
    // init uses
    this._useList || (this._useList = [])
    this._useList.sort((a, b) => {
      return a.index - b.index
    }).forEach(use => {
      const callback: NamespaceMiddleware = (typeof use.callback === 'function')
        ? use.callback : this[use.callback].bind(this)
      namespace.use((socket, next) => callback(socket, next, this))
    })

    // init befores
    // this._preBefores || (this._preBefores = {})
    // this._befores || (this._befores = {})
    // Object.keys(this._preBefores).forEach(event => {
    //   const callbacks = this._preBefores[event].map(callback => {
    //     switch(typeof callback) {
    //       case 'function': {
    //         return callback
    //       }
    //       case 'string': {
    //         return this[callback as any].bind(this)
    //       }
    //       default: {
    //         throw new Error('the callback must be function or string type.')
    //       }
    //     }
    //   })
    //   this._befores[event] = this._makeTotalCallback(callbacks)
    // })

    // init each socket
    this._onList || (this._onList = [])
    this.namespace.on('connect', socket => {
      // (socket as any).use(this._routeBefore(socket))
      this._onList.forEach(on => {
        const callback: (socket: Socket, ...args: any[]) => Promise<void>|void = this[on.callback].bind(this)
        if(on.wrappers.length !== 0) {
          const wrappers = [...on.wrappers].reverse()
          socket.on(on.event, (...args) => {
            const kingWrapper = wrappers.reduce((next, wrapper) => (() => wrapper(socket, args, next as any))
              , () => callback(socket, ...args))
            return (kingWrapper as any)()
          })
        } else {
          socket.on(on.event, (...args) => callback(socket, ...args))
        }
      })
    })

    // init onconnection
    this._onconnectionList || (this._onconnectionList = [])
    this._onconnectionList.forEach(callback => {
      this.namespace.on('connect', this[callback].bind(this))
    })
  }

  // private _routeBefore(socket: Socket) {
  //   return (packet: any[], next: (err?: Error) => Promise<void>) => {
  //     if(packet[0] && this._befores[packet[0]]) {
  //       this._befores[packet[0]](packet, next, socket)
  //       return
  //     }
  //     next()
  //   }
  // }

  // private _makeTotalCallback(callbacks: SocketMiddleware[]) {
  //   return (packet: any[], n: (err?: Error) => void, ctx: Socket) => {
  //     const next = (err?: Error) => {
  //       if(err) {
  //         n(err)
  //         return
  //       }
  //       const c = callbacks.shift()
  //       if(c) {
  //         c(packet, next, ctx)
  //       } else {
  //         n()
  //       }
  //     }
  //     next()
  //   }
  // }

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
export function Use(middleware: NamespaceMiddleware): (target: any) => void
export function Use(index: number, middleware: NamespaceMiddleware): (target: any) => void
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

const on = createWrapper().on()
on['wrap'] = createWrapper().next

export const On: {
  (event: string): (target: any, name: string, descriptor: PropertyDescriptor) => void
  wrap: (wrapper: SocketWrapper) =>Recursive
} = on as any

export type Recursive = {
  next: (wrapper: SocketWrapper) => Recursive
  on: () => (event: string) => (target: any, callback: string, descriptor: PropertyDescriptor) => void
}

function createWrapper() {
  const preparedWraps: SocketWrapper[] = []
  const recursive = {
    next: (wrapper: SocketWrapper) => {
      preparedWraps.push(wrapper)
      return recursive
    },
    on: () => {
      const wrappers = [...preparedWraps]
      return (event: string) => {
        return (target: any, callback: string, descriptor: PropertyDescriptor) => {
          target._onList = target._onList || []
          target._onList.push({
            event,
            callback,
            wrappers,
          })
        }
      }
    }, 
  }
  return recursive
}

export function OnConnection() {
  return (target: any, name: string, descriptor: PropertyDescriptor) => {
    target._onconnectionList || (target._onconnectionList = [])
    target._onconnectionList.push(name)
  }
}
