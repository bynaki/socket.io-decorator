/**
 * configure
 * 보안이 필요한 정보나 설정을 저장한다.
 * 사용하려면 이 파일을 복사해 config.ts 파일을 만들어야 한다.
 */

import {
  JwtConfig,
} from './interface'


export default {
  jwt: {                          // JwtConfig
    secret: '8PoRtSwiTchIngHuB',  // jwt 토큰을 만들기 위한 비밀키
    options: {
      issuer: 'bynaki',           // 발급자
      subject: 'authentication',  // 제목
      expiresIn: '1d',            // 만료 기간
    }
  } as JwtConfig
}
