async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message) }
  const context = page.context()
  const manifest = await page.evaluate(() => fetch(document.querySelector('link[rel=manifest]').href).then(response => response.json()))
  assert(manifest.display === 'standalone' && manifest.icons.some(icon => icon.sizes === '512x512') && manifest.icons.some(icon => icon.sizes === '192x192'), 'Manifest incomplete')
  // Wait for the service worker to install and take control of the page.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller)
  await page.getByRole('textbox', { name: 'Contenu Markdown' }).waitFor()
  await context.setOffline(true)
  await page.reload()
  const editor = page.getByRole('textbox', { name: 'Contenu Markdown' })
  await editor.waitFor()
  await editor.focus()
  await editor.press('ControlOrMeta+a')
  await page.keyboard.insertText('# Hors ligne\n\n```mermaid\nflowchart LR\n A --> B\n```')
  await page.getByText('Aperçu à jour', { exact: true }).waitFor()
  assert(await page.locator('#print-document .mermaid-diagram svg').count() === 1, 'Mermaid diagram not rendered offline')
  assert(await page.locator('#print-document h1:has-text("Hors ligne")').count() === 1, 'Preview not rendered offline')
  await context.setOffline(false)
  console.log('PASS: manifest, service worker, app and Mermaid work offline')
}
