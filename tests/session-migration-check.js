async (page) => {
  const context = await page.context().browser().newContext()
  const check = await context.newPage()
  const base = await page.evaluate(() => location.origin)
  const assert = (value, message) => { if (!value) throw new Error(message) }
  try {
    await check.route(base + '/migration-seed', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Fixture</body></html>' }))
    await check.goto(base + '/migration-seed')
    await check.evaluate(async () => {
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('papier', 1)
        request.onupgradeneeded = () => request.result.createObjectStore('session')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction('session', 'readwrite')
          const image = new File(['<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="blue"/></svg>'], 'test.svg', { type: 'image/svg+xml' })
          const content = '# Ancienne session\n\n![Image](images/test.svg)'
          transaction.objectStore('session').put({ markdown: content, fileName: 'ancien.md', folderName: 'ancien dossier', activeDocumentPath: 'ancien.md', documents: [{ path: 'ancien.md', name: 'ancien.md', content }, { path: 'autre.md', name: 'autre.md', content: '# Autre conservé' }], assets: new Map([['images/test.svg', image]]), settings: { format: 'A4', margins: 'wide', theme: 'modern', zoom: 70 } }, 'current')
          transaction.oncomplete = () => { database.close(); resolve() }
          transaction.onerror = () => reject(transaction.error)
        }
      })
    })
    await check.goto(base)
    await check.getByText('Enregistré dans ce navigateur', { exact: true }).waitFor()
    await check.getByText('Aperçu à jour', { exact: true }).waitFor()
    assert(await check.locator('#print-document img').evaluate(image => image.naturalWidth === 80), 'Migrated image missing')
    assert(await check.getByRole('combobox', { name: 'Marges', exact: true }).inputValue() === 'wide', 'Settings lost during migration')
    await check.getByRole('combobox', { name: 'Document Markdown à afficher' }).selectOption('autre.md')
    assert((await check.getByRole('textbox', { name: 'Contenu Markdown' }).textContent()).includes('Autre conservé'), 'Other document lost during migration')
    await check.getByText('Enregistré dans ce navigateur', { exact: true }).waitFor()
    await check.reload()
    await check.getByText('Enregistré dans ce navigateur', { exact: true }).waitFor()
    assert(await check.getByRole('combobox', { name: 'Document Markdown à afficher' }).inputValue() === 'autre.md', 'Migrated selection not persisted')
    const counts = await check.evaluate(async () => {
      const request = indexedDB.open('papier')
      return await new Promise(resolve => {
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction(['assets', 'documents'])
          const assets = transaction.objectStore('assets').count()
          const documents = transaction.objectStore('documents').count()
          transaction.oncomplete = () => { resolve({ version: database.version, assets: assets.result, documents: documents.result }); database.close() }
        }
      })
    })
    assert(counts.version === 2 && counts.assets === 1 && counts.documents === 2, 'Migration did not split storage records correctly')
  } finally { await context.close() }
}
