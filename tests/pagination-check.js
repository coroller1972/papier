async (page) => {
  await page.emulateMedia({ media: null })
  await page.setViewportSize({ width: 1440, height: 1000 })
  const editor = page.getByRole('textbox', { name: 'Contenu Markdown' })
  const setText = async text => { await editor.focus(); await editor.press('ControlOrMeta+a'); await page.keyboard.insertText(text); await page.locator('#print-document[aria-busy="true"]').waitFor({ state: 'attached' }) }
  const editorText = () => editor.evaluate(element => Array.from(element.querySelectorAll('.cm-line')).map(line => line.textContent).join('\n'))
  const assert = (value, message) => { if (!value) throw new Error(message) }
  const ready = () => page.getByText('Aperçu à jour', { exact: true }).waitFor()
  const pages = page.locator('#print-document .pagedjs_page')
  await page.getByRole('combobox', { name: 'Format', exact: true }).selectOption('A4')
  await page.getByRole('combobox', { name: 'Marges', exact: true }).selectOption('normal')
  const cases = [
    ['texte', '# Rapport\n\n' + Array.from({length: 90}, (_, i) => `## Section ${i + 1}\n\n` + `Paragraphe ${i + 1}. ` + 'Texte de contrôle et de pagination. '.repeat(12)).join('\n\n')],
    ['tableau', '# Tableau long\n\n| Référence | Description |\n| --- | --- |\n' + Array.from({length: 120}, (_, i) => `| Ligne ${i + 1} | Description de contrôle pour vérifier la continuité du tableau. |`).join('\n')],
    ['tableau-large', '# Contrat API\n\n| Méthode | Endpoint | Fonction | Exemple de corps ou paramètres | Précondition | Succès |\n| --- | --- | --- | --- | --- | --- |\n' + Array.from({length: 32}, (_, i) => `| POST | \`/sessions/{sessionId}/resources/{resourceIdentifier}/operation-${i}\` | Actualiser la ressource | \`{"resourceIdentifier":"${'long_identifier_'.repeat(7)}","enabled":true}\` | Idempotency-Key | 200 : ligne ${i + 1} |`).join('\n')],
    ['mermaid', '# Première page\n\nTexte avant le saut.\n\n<!-- pagebreak -->\n\n# Diagramme\n\n```mermaid\nflowchart TD\n A[Début] --> B[Relecture] --> C[Publication]\n```\n\nFin du document.'],
  ]
  const counts = {}
  for (const [name, markdown] of cases) {
    await setText(markdown)
    await ready()
    const count = await pages.count()
    counts[name] = count
    assert(count > 1, name + ': expected multiple pages')
    if (name === 'mermaid') {
      assert(count === 2, 'Manual break should yield exactly two pages')
      assert(await pages.nth(1).locator('svg').count() === 1, 'Mermaid should be whole on second page')
    }
    if (name.startsWith('tableau')) {
      for (let i = 0; i < count; i++) {
        assert(await pages.nth(i).locator('thead').count() === 1, 'Table header not repeated on page ' + (i + 1))
      }
      assert((await page.locator('#print-document').textContent()).includes(name === 'tableau' ? 'Ligne 120' : 'ligne 32'), 'Last table row lost')
    }
    const overflowing = await page.locator('#print-document table').evaluateAll(tables => tables.flatMap(table => {
      const boundary = table.closest('.pagedjs_page_content').getBoundingClientRect()
      const walker = document.createTreeWalker(table, NodeFilter.SHOW_TEXT)
      let right = table.getBoundingClientRect().right
      while (walker.nextNode()) {
        const range = document.createRange()
        range.selectNodeContents(walker.currentNode)
        for (const rectangle of range.getClientRects()) right = Math.max(right, rectangle.right)
      }
      return right > boundary.right + 1 ? [table.closest('.pagedjs_page').dataset.pageNumber] : []
    }))
    assert(!overflowing.length, name + ': overflowing table or text on pages ' + overflowing.join(', '))
    await page.getByRole('combobox', { name: 'Page à afficher' }).selectOption('1')
    await page.getByRole('button', { name: 'Page suivante', exact: true }).click()
    assert(await page.getByRole('combobox', { name: 'Page à afficher' }).inputValue() === '2', 'Page navigation failed')
    await page.emulateMedia({ media: 'print' })
    const pdf = await page.pdf({ path: `output/playwright/pagination-${name}.pdf`, preferCSSPageSize: true })
    assert((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length === count, name + ': PDF page count differs from preview')
    await page.emulateMedia({ media: null })
  }
  await page.getByRole('combobox', { name: 'Page à afficher' }).selectOption('1')
  await page.screenshot({ path: 'output/playwright/pagination-desktop.png' })
  await setText('# Début\n\nFin')
  await editor.focus()
  await editor.press('ControlOrMeta+End')
  await page.getByRole('button', { name: 'Insérer un saut de page' }).click()
  assert((await editorText()).includes('<!-- pagebreak -->'), 'Manual break button failed')
  await setText('```html\n<!-- pagebreak -->\n```')
  await ready()
  assert(await page.locator('#print-document .manual-page-break').count() === 0, 'Code example interpreted as a break')
  await setText(cases.find(([name]) => name === 'mermaid')[1])
  await ready()
  await page.getByRole('combobox', { name: 'Format', exact: true }).selectOption('Letter')
  await ready()
  await page.getByRole('combobox', { name: 'Marges', exact: true }).selectOption('wide')
  await ready()
  await page.emulateMedia({ media: 'print' })
  await page.pdf({path:'output/playwright/pagination-letter.pdf',preferCSSPageSize:true})
  await page.emulateMedia({ media: null })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Aperçu', exact: true }).click()
  await page.screenshot({ path: 'output/playwright/pagination-mobile.png' })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow')
  await page.evaluate(counts => { window.paginationResults = counts }, counts)
}
