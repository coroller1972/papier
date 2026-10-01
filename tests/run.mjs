// Runs every tests/*-check.js (an `async (page) => {...}` expression) against the Vite dev server,
// because some checks import src modules to read cache and pagination counters.
// Checks named *-preview-check.js (service worker, offline) run against the production build in dist/ instead.
import { readdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createServer, preview } from 'vite'

const server = await createServer({ server: { port: 5199, open: false }, logLevel: 'error' })
await server.listen()
const url = server.resolvedUrls.local[0]
const production = await preview({ preview: { port: 4199, open: false }, logLevel: 'error' })
const productionUrl = production.resolvedUrls.local[0]
const browser = await chromium.launch()
const only = process.argv[2]
const files = (await readdir('tests')).filter(f => f.endsWith('-check.js') && (!only || f.includes(only))).sort()
let failed = 0
for (const file of files) {
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()
  const started = Date.now()
  try {
    const run = (0, eval)(`(${await readFile(`tests/${file}`, 'utf8')})`)
    await page.goto(file.endsWith('-preview-check.js') ? productionUrl : url)
    await run(page)
    console.log(`ok   ${file} (${((Date.now() - started) / 1000).toFixed(1)}s)`)
  } catch (error) {
    failed++
    console.error(`FAIL ${file}\n${error instanceof Error ? error.message : error}`)
  } finally {
    await context.close()
  }
}
await browser.close()
await server.close()
await new Promise(resolve => production.httpServer.close(resolve))
process.exit(failed ? 1 : 0)
