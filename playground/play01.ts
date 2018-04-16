/**
 * Array#filter: !== 가 해당 인스턴스 만 지우는가?
 */

class Stupid {
  constructor(public name) {}
}

let stupids = []
const s1 = new Stupid('foobar')
const s2 = new Stupid('biggle')
const s3 = new Stupid('nabi')
stupids.push(s1)
stupids.push(s2)
stupids.push(s3)

stupids = stupids.filter(s => {
  return s !== s2
})

console.log('stupids: ', stupids)
console.log('length: ', stupids.length)

// stupids:  [ Stupid { name: 'foobar' }, Stupid { name: 'nabi' } ]
// length:  2