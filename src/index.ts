/**
 * Socket.IO with Decorator
 */

import * as SocketIO from 'socket.io'
import {
  Server,
  ServerOptions,
  Socket,
} from 'socket.io'

export type Middleware = (packet: any[], next: (err?: Error) => Promise<void>, ctx?: BaseSocket) => Promise<void>|void


let socketList: BaseSocket[] = []

export class BaseSocket {
  private _onList: {event: string, callback: string}[]
  private _useList: {callback: Middleware, index: number}[]
  private _preBefores: {[index: string]: Middleware[]}
  private _befores: {[index: string]: Middleware}

  // io.clients 와 같이 접속한 client 수와 같지 않다.
  // 단순히 가비지 컬렉션 되지않기 위해서 사용한다.
  static get socketList() {
    return socketList
  }

  constructor(private _socket: Socket) {
    socketList.push(this)
    this.socket.on('disconnect', reason => {
      socketList = socketList.filter(socket => {
        return socket !== this
      })
    })
    this._useList || (this._useList = [])
    this._useList.sort((a, b) => {
      return a.index - b.index
    }).forEach(use => {
      if(typeof use.callback === 'function') {
        (this.socket as any).use(this._wrapUse(use.callback))
      } else {
        (this.socket as any).use(this._wrapUse(this[use.callback].bind(this)))
      }
    })
    this._preBefores || (this._preBefores = {})
    this._befores || (this._befores = {})
    Object.keys(this._preBefores).forEach(event => {
      const callbacks = this._preBefores[event].map(callback => {
        switch(typeof callback) {
          case 'function': {
            return callback
          }
          case 'string': {
            return this[callback as any].bind(this)
          }
          default: {
            throw new Error('the callback must be function or string type.')
          }
        }
      })
      this._befores[event] = this._makeTotalCallback(callbacks)
    });
    (this.socket as any).use(this._routeBefore.bind(this))
    this._onList || (this._onList = [])
    this._onList.forEach(on => {
      this.socket.on(on.event, this.wrap(this[on.callback].bind(this)))
    })
  }

  private _routeBefore(packet: any[], next: (err?: Error) => Promise<void>) {
    if(packet[0] && this._befores[packet[0]]) {
      this._befores[packet[0]](packet, next, this)
      return
    }
    next()
  }

  private _makeTotalCallback(callbacks: Middleware[]) {
    return async (packet: any[], n: (err?: Error) => Promise<void>, ctx: BaseSocket) => {
      const next = async (err?: Error) => {
        if(err) {
          n(err)
          return
        }
        const c = callbacks.shift()
        if(c) {
          await c(packet, next, ctx)
        } else {
          n()
        }
      }
      next()
    }
  }

  private _wrapUse(use: Middleware) {
    return (packet: any[], next: (err?: Error) => Promise<void>): Promise<void>|void => {
      return use(packet, next, this)
    }
  }

  protected wrap(target: (...args: any[]) => Promise<void>) {
    return async (...args: any[]) => {
      try {
        await target(...args)
      } catch(err) {
        if(this.socket.listeners('error').length !== 0) {
          this.emit('error', err)
        } else {
          throw err
        }
      }
    }
  }

  get socket() {
    return this._socket
  }

  get handshake() {
    return this._socket.handshake
  }

  emit(event: string|symbol, ...args: any[]): boolean {
    return this.socket.emit(event, ...args)
  }

  send(...args: any[]) {
    return this.socket.send(...args)
  }
}


export function On(event: string, ...befores: (Middleware|string)[]) {
  return (target: any, name: string, descriptor: PropertyDescriptor) => {
    target._onList || (target._onList = [])
    target._onList.push({
      event,
      callback: name,
    })
    if(befores.length !== 0) {
      target._preBefores || (target._preBefores = [])
      target._preBefores[event] = befores
    }
  }
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
