/**
 * status code 와 함께 Error 객체
 */

export class ErrorWithStatusCode extends Error {
  constructor(message: string, public status: number = 200) {
    super(message)
  }
}

export class ErrorBadRequest extends ErrorWithStatusCode {
  constructor(msg?: string) {
    (msg)? super(`Bad Request: ${msg}`, 400) : super('Bad Request', 400)
  }
}

export class ErrorUnauthorized extends ErrorWithStatusCode {
  constructor(msg?: string) {
    (msg)? super(`Unauthorized: ${msg}`, 401) : super('Unauthorized', 401)
  }
}

export class ErrorNotFound extends ErrorWithStatusCode {
  constructor(msg?: string) {
    (msg)? super(`Not Found: ${msg}`, 404) : super('Not Found', 404)
  }
}
