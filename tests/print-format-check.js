async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message) }
  const editor = page.getByRole('textbox', { name: 'Contenu Markdown' })
  await editor.waitFor()
  await editor.focus()
  await editor.press('ControlOrMeta+a')
  await page.keyboard.insertText('# Rapport\n\n' + Array.from({ length: 60 }, (_, i) => `Paragraphe ${i + 1}. ` + 'Texte de contrôle. '.repeat(30)).join('\n\n'))
  const expected = { A4: [595, 842], Letter: [612, 792] }
  for (const format of ['A4', 'Letter']) {
    for (const margins of ['compact', 'normal', 'wide']) {
      await page.getByRole('combobox', { name: 'Format', exact: true }).selectOption(format)
      await page.getByRole('combobox', { name: 'Marges', exact: true }).selectOption(margins)
      await page.getByText('Aperçu à jour', { exact: true }).waitFor()
      await page.waitForFunction(() => document.querySelector('#print-document')?.getAttribute('aria-busy') === 'false')
      const previewPages = await page.locator('#print-document .pagedjs_page').count()
      await page.emulateMedia({ media: 'print' })
      const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1')
      await page.emulateMedia({ media: null })
      const boxes = [...pdf.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map(match => [Math.round(match[1]), Math.round(match[2])])
      const label = `${format}/${margins}`
      assert(boxes.length === previewPages, `${label}: PDF has ${boxes.length} pages, preview ${previewPages}`)
      assert(boxes.every(([w, h]) => w === expected[format][0] && h === expected[format][1]), `${label}: wrong PDF page size ${JSON.stringify(boxes[0])}`)
    }
  }
  console.log('PASS: PDF page size and page count match settings (A4/Letter × 3 margins)')
}
