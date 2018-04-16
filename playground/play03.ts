
const target: {index: number, input: number}[] = []

target.push({index: 100, input: 0})
target.push({index: 3, input: 1})
target.push({index: 0, input: 2})
target.push({index: -1, input: 3})
target.push({index: 200, input: 4})
target.push({index: 100, input: 5})

const sorted = target.sort((a, b) => {
  return a.index - b.index
})

console.log('sorted: ', sorted)