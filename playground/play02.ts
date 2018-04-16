/**
 * 비 async 함수도 await를 붙여도 상관 없는지?
 */


function notAsyncFunc() {
  return 'notAsyncFunc'
}

const mirror: () => Promise<string>|string = notAsyncFunc

async function main() {
  return await mirror()
}

main().then(res => {
  console.log(res)
})

// notAsyncFunc