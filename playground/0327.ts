const sleep = (delay: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, delay)
  })
}

async function retryWithBackoff(
  fn: () => Promise<any>,
  maxRetries: number,
  baseDelay: number
): Promise<any> {
  try {
    const res = await fn()
    return res
  } catch (err) {
    if (maxRetries <= 1) {
      throw err
    }
    await sleep(baseDelay)
    return retryWithBackoff(fn, maxRetries - 1, baseDelay * 2)
  }
}
