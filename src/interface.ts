/**
 * Interface
 */

export interface DecodedToken {
  user?: string
  permissions?: string[]
  // name: string  // 토큰 이름을 정한다. 약속된 이름이다 보안을 위해 수시로 바뀔수 있다.
  iat: number   // 생성시간
  exp: number   // 만료시간
  iss: string   // 토큰 발급자
  sub: string   // 토큰 제목
}

export interface JwtConfig {
  secret: string        // 비밀키
  options: {
    expiresIn: string   // 만료 기간
    issuer: string      // 발급자
    subject: string     // 제목
  }
}