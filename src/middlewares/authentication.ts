/**
 * authenticaion middleware
 * 인증을 위해 jwt 토큰을 decoded하고 저장한다.
 */

import * as jwt from 'jsonwebtoken'
import {
  JwtConfig,
  DecodedToken,
} from '../interface'
import {
  ErrorWithStatusCode,
  ErrorUnauthorized,
} from '../errors'
import {
  Context,
} from 'koa'


export function authentication(config: JwtConfig) {
  return (ctx: Context, next: () => Promise<any>) => {
    // read the token from header of url
    const token = ctx.headers['x-access-token'] || ctx.query.token
    
    // token does not exist
    if(!token) {
      return next()
    }

    try {
      // create a promise that decodes the token
      const decoded: DecodedToken = jwt.verify(token, config.secret) as DecodedToken
      if(decoded.iss !== config.options.issuer 
        || decoded.sub !== config.options.subject) {
          throw new Error('The wrong token.')
      }
      let now = Date.now()
      now = (now - now % 1000) / 1000
      if (!(now >= decoded.iat && now <= decoded.exp)) {
        throw new Error('The authentication has expired.')
      }
      ctx['_decoded'] = decoded
      return next()
    } catch(err) {
      // if it has failed to verify, it will return an error message
      throw new ErrorUnauthorized(err.message)
    } 
  }
}

export function getDecodedToken(ctx: Context): DecodedToken {
  return ctx['_decoded']
}

export function certify(...permissions: string[]) {
  return (ctx: Context, next: () => Promise<any>) => {
    const decoded = getDecodedToken(ctx)
    if(decoded && decoded.user && (decoded.user === ctx.params.user)) {
      decoded.permissions = decoded.permissions || []
      if(permissions.indexOf('read') !== -1 
        && decoded.permissions.indexOf('read') === -1) {
        throw new ErrorUnauthorized('You have no authority.')
      }
      if(permissions.indexOf('write') !== -1 
        && decoded.permissions.indexOf('write') === -1) {
        throw new ErrorUnauthorized('You have no authority.')
      }
    } else {
      throw new ErrorUnauthorized('You are not me.')
    }
    next()
  }
}

