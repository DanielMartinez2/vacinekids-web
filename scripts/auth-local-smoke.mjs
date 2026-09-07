// Optional real-browser smoke test. Explicitly LOCAL; never part of npm test.
// Requires Playwright supplied externally, a local API and Vite. No remote/admin operations.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const frontend = 'http://localhost:5173'
const api = 'http://localhost:3001'
if (process.env.CONFIRM_LOCAL_POSTGRES !== 'yes') {
  throw new Error('Verify the API uses loopback PostgreSQL, then explicitly set CONFIRM_LOCAL_POSTGRES=yes. Local HTTP alone cannot prove database isolation.')
}
const health = await fetch(api + '/health').then((response) => response.json())
assert.equal(health.data?.environment, 'development', 'Requires a verified local development API')
assert.equal(health.data?.database, 'connected')
if (!process.env.PLAYWRIGHT_MODULE || !process.env.CHROME_EXECUTABLE) {
  throw new Error('Set PLAYWRIGHT_MODULE and CHROME_EXECUTABLE to existing local installations.')
}
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
page.setDefaultTimeout(15000)
const email = 'phase1b-' + Date.now() + '@example.test'
const password = 'Frase local ' + randomBytes(24).toString('base64url')
let phase = 'bootstrap'
const apiCalls = []
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.name))
page.on('response', (response) => {
  if (response.url().startsWith(api + '/api/v1/auth/')) apiCalls.push({
    path: new URL(response.url()).pathname, method: response.request().method(), status: response.status(),
    csrf: response.request().headers()['x-vacinekids-csrf'] ?? null,
  })
})
await context.route('**/*', (route) => {
  const url = new URL(route.request().url())
  return [frontend, api].includes(url.origin) ? route.continue() : route.abort()
})
const visible = async (locator) => { await locator.waitFor({ state: 'visible' }) }
const nav = () => page.getByRole('navigation', { name: 'Principal' })
const storage = () => page.evaluate(() => ({
  cart: localStorage.getItem('vacinekids-cart-v1'), keys: Object.keys(localStorage), sessionKeys: Object.keys(sessionStorage),
}))
try {
  phase = 'visitor + independent cart'
  await page.goto(frontend + '/vacinekids-web/#/produtos')
  await visible(nav().getByRole('link', { name: 'Entrar', exact: true }))
  await page.getByRole('button', { name: /Adicionar .* ao carrinho/ }).first().click()
  const before = await storage()
  assert.ok(before.cart)
  phase = 'registration'
  await nav().getByRole('link', { name: 'Criar conta', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByLabel('Confirmar senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await visible(page.getByText('Cadastro processado. Agora você pode entrar.'))
  assert.equal((await context.cookies(api)).some((cookie) => cookie.name === 'vacinekids_session'), false)
  phase = 'login'
  await page.getByRole('main').getByRole('link', { name: 'Entrar', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await visible(page.getByRole('heading', { name: 'Minha conta', exact: true }))
  const cookie = (await context.cookies(api)).find((item) => item.name === 'vacinekids_session')
  assert.ok(cookie)
  assert.equal(cookie.httpOnly, true)
  assert.equal(cookie.sameSite, 'Lax')
  assert.equal(cookie.path, '/')
  assert.equal(cookie.secure, false)
  assert.equal(await page.evaluate(() => document.cookie.includes('vacinekids_session=')), false)
  const afterLogin = await storage()
  assert.deepEqual(afterLogin.keys, ['vacinekids-cart-v1'])
  assert.deepEqual(afterLogin.sessionKeys, [])
  assert.equal(afterLogin.cart, before.cart)
  phase = 'reload reconstructs session'
  const callsBeforeReload = apiCalls.length
  await page.reload()
  await visible(page.getByRole('heading', { name: 'Minha conta', exact: true }))
  await visible(page.getByText(email, { exact: true }))
  assert.ok(apiCalls.slice(callsBeforeReload).some((call) => call.path.endsWith('/me') && call.status === 200))
  await mkdir('test-results/auth-local', { recursive: true })
  await page.screenshot({ path: 'test-results/auth-local/account-desktop.png', fullPage: true })
  phase = 'mobile navigation'
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await visible(nav().getByRole('link', { name: 'Minha conta', exact: true }))
  await page.screenshot({ path: 'test-results/auth-local/account-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Fechar menu' }).click()
  phase = 'CUSTOMER cannot access admin'
  await page.goto(frontend + '/vacinekids-web/#/admin')
  await visible(page.getByRole('heading', { name: 'Acesso não autorizado', exact: true }))
  await visible(page.getByText('403', { exact: true }))
  phase = 'failed logout is not fake success'
  await page.goto(frontend + '/vacinekids-web/#/minha-conta')
  await visible(page.getByRole('heading', { name: 'Minha conta', exact: true }))
  await page.route(api + '/api/v1/auth/logout', (route) => route.abort(), { times: 1 })
  await page.getByRole('main').getByRole('button', { name: 'Sair', exact: true }).click()
  await visible(page.getByText(/Sua sessão pode continuar ativa/))
  assert.ok((await context.cookies(api)).find((item) => item.name === 'vacinekids_session'))
  phase = 'retry logout + reload'
  await page.getByRole('button', { name: /Tentar novamente/ }).click()
  await visible(page.getByRole('heading', { name: 'Um catálogo mais simples para escolhas mais tranquilas.' }))
  assert.equal((await context.cookies(api)).some((item) => item.name === 'vacinekids_session'), false)
  await page.reload()
  await page.goto(frontend + '/vacinekids-web/#/minha-conta')
  await visible(page.getByRole('heading', { name: 'Entrar', exact: true }))
  assert.match(page.url(), /#\/login$/)
  const afterLogout = await storage()
  assert.equal(afterLogout.cart, before.cart)
  assert.deepEqual(afterLogout.keys, ['vacinekids-cart-v1'])
  assert.deepEqual(afterLogout.sessionKeys, [])
  for (const call of apiCalls) {
    if (call.method === 'GET') assert.equal(call.csrf, null)
    else assert.equal(call.csrf, '1')
  }
  assert.ok(apiCalls.some((call) => call.path.endsWith('/logout') && call.status === 204))
  assert.ok(apiCalls.some((call) => call.path.endsWith('/me') && call.status === 401))
  assert.deepEqual(pageErrors, [])
  console.log(JSON.stringify({
    result: 'passed', localAccountCreated: 1, remoteCalls: 0,
    httpOnly: true, invisibleToDocumentCookie: true, restoredAfterReload: true,
    customerAdmin: 403, failedLogoutRecoverable: true, logout: 204,
    sessionNotRestoredAfterLogout: true, cartUnchanged: true, authWebStorage: false,
    apiCalls,
  }))
} catch (error) {
  // Do not output form values, cookies, response bodies or browser traces.
  console.error('Local browser validation failed at phase: ' + phase + ' (' + error.name + ')')
  process.exitCode = 1
} finally { await context.close(); await browser.close() }
