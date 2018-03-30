import {
  statSync,
  existsSync,
  copySync,
  copy,
  readFile,
} from 'fs-extra'
import * as glob from 'glob'
import {
  join,
  resolve,
} from 'path'
import p from 'fourdollar.promisify'


export async function copyAssets(src: string, dest: string) {
  const files: string[] = await p<string[]>(glob)(src)
  files.forEach(s => {
    const st = statSync(s)
    if(st.isFile()) {
      const d = join(dest, s.replace(/^[^\/]+/, ''))
      if(!(existsSync(d) && statSync(d).mtimeMs === st.mtimeMs)) {
        copySync(s, d)
        console.log(`copied: ${s} > ${d}`)
      }
    }
  })
}

const releaseDir = '../../www/release'
export async function release() {
  const packFile = await readFile('package.json')
  const pack = JSON.parse(packFile.toString())
  await copy('archive.tar.gz', join(releaseDir, pack.name))
}
