import {
  Server,
  Namespace,
  Socket,
} from 'socket.io'
import {
  snakeCase,
} from 'lodash' 
import { on } from 'cluster';


export {Server, Namespace, Socket}
export type Middleware = (socket: Socket, next: (err?: Error) => void, ctx: BaseNamespace) => void
export type SocketWrapper = (socket: Socket, args: any[], next: () => Promise<void>|void) => Promise<void>|void
export type ConnectCallback = (socket: Socket, ctx: BaseNamespace) => void
export type DisconnectCallback = (reason: string, socketId: string, ctx: BaseNamespace) => void
export type ClassDecoratorType = (target: any, name: string, descriptor: PropertyDescriptor) => void
export type MethodDecoratorType = (target: any) => void


type OnCollection = {
  useList: {callback: Middleware|string, index: number}[]
  onList: {event: string, callback: string , wrappers?: SocketWrapper[]}[]
  onconnectList: (ConnectCallback | string)[]
  ondisconnectList: (DisconnectCallback | string)[]
}

const onCollections: {
  [className: string]: OnCollection
} = {}


function initOnCollection(name: string): OnCollection {
  if(!onCollections[name]) {
    onCollections[name] = newOnCollection()
  }
  return onCollections[name]
}

function newOnCollection(): OnCollection {
  return {
    useList: [],
    onList: [],
    onconnectList: [],
    ondisconnectList: [],
  }
}

export class BaseNamespace {
  // private _useList: {callback: Middleware|string, index: number}[]
  // private _onList: {event: string, callback: string , wrappers?: SocketWrapper[]}[] 
  // private _onconnectList: (ConnectCallback | string)[]
  // private _ondisconnectList: (DisconnectCallback | string)[]

  constructor(readonly namespace: Namespace) {
    const ons = this._inheritOnCollection()

    // init uses
    ons.useList.sort((a, b) => {
      return a.index - b.index
    }).forEach(use => {
      const callback: Middleware = (typeof use.callback === 'function')
        ? use.callback : this[use.callback].bind(this)
      namespace.use((socket, next) => callback(socket, next, this))
    })

    // init each socket
    this.namespace.on('connect', socket => {
      ons.onList.forEach(on => {
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

    // init onconnect
    ons.onconnectList.forEach(callback => {
      if(typeof callback === 'function') {
        this.namespace.on('connect', socket => {
          callback(socket, this)
        })
      } else {
        this.namespace.on('connect', socket => {
          this[callback](socket, this)
        })
      }
    })

    // init ondisconnect
    this.namespace.on('connection', socket => {
      ons.ondisconnectList.forEach(callback => {
        if(typeof callback === 'function') {
          socket.on('disconnect', reason => {
            callback(reason, socket.id, this)
          })
        } else {
          socket.on('disconnect', reason => {
            this[callback](reason, socket.id, this)
          })
        }
      })
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

  public _getSupers(): string[] {
    const ss: string[] = []
    let sp = this['__proto__']
    while(sp) {
      ss.push(sp.constructor.name)
      sp = sp['__proto__']
    }
    return ss
  }

  private _inheritOnCollection(): OnCollection {
    const supers = this._getSupers().slice(0, -1)
    const inherited = newOnCollection()
    supers.forEach(s => {
      const collec = initOnCollection(s)
      collec.onList.forEach(on => {
        if(inherited.onList.find(o => o.event === on.event || o.callback === on.callback)) {
          if(inherited.onList.find(o => o.event !== on.event && o.callback === on.callback)) {
            throw Error('상속 클래스 상호간에 충돌이 있다: 같은 callback이 서로 다른 event에 호출 될 수 없다.')
          }
          if(inherited.onList.find(o => o.event === on.event && o.callback !== on.callback)) {
            inherited.onList.push(on)
          } else {
            // if(o.event === on.event && o.callback === on.callback)면 무시
          }
        } else {
          inherited.onList.push(on)
        }
      })
      collec.useList.forEach(use => {
        if(typeof use.callback === 'string') {
          if(!inherited.useList.find(u => u.callback === use.callback)) {
            inherited.useList.push(use)
          }
        } else {
          inherited.useList.push(use)
        }
      })
      collec.onconnectList.forEach(on => {
        if(typeof on === 'string') {
          if(!inherited.onconnectList.find(o => o === on)) {
            inherited.onconnectList.push(on)
          }
        } else {
          inherited.onconnectList.push(on)
        }
      })
      collec.ondisconnectList.forEach(on => {
        if(typeof on === 'string') {
          if(!inherited.ondisconnectList.find(o => o === on)) {
            inherited.ondisconnectList.push(on)
          }
        } else {
          inherited.ondisconnectList.push(on)
        }
      })
    })
    return inherited
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
      const inited = initOnCollection(target.prototype.constructor.name)
      inited.useList.push({callback: b, index: a})
    }
  } else {
    return (target: any, name: string, descriptor: PropertyDescriptor) => {
      const inited = initOnCollection(target.constructor.name)
      inited.useList.push({callback: name, index: a})
    }
  }
}

export function OnConnect(): ClassDecoratorType
export function OnConnect(callback: ConnectCallback): MethodDecoratorType
export function OnConnect(callback?: ConnectCallback) {
  if(callback) {
    return (target: any) => {
      const inited = initOnCollection(target.prototype.constructor.name)
      inited.onconnectList.push(callback)
    }
  } else {
    return (target: any, name: string, descriptor: PropertyDescriptor) => {
      const inited = initOnCollection(target.constructor.name)
      inited.onconnectList.push(name)
    }
  }
}

export function OnDisconnect(): ClassDecoratorType
export function OnDisconnect(callback: DisconnectCallback): MethodDecoratorType
export function OnDisconnect(callback?: DisconnectCallback) {
  if(callback) {
    return (target: any) => {
      const inited = initOnCollection(target.prototype.constructor.name)
      inited.ondisconnectList.push(callback)
    }
  } else {
    return (target: any, name: string, descriptor: PropertyDescriptor) => {
      const inited = initOnCollection(target.constructor.name)
      inited.ondisconnectList.push(name)
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
        const name = target.constructor.name
        const inited = initOnCollection(target.constructor.name)
        inited.onList.push({
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
