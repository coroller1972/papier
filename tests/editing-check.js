async (page) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const assert = (value, message) => { if (!value) throw new Error(message) }
  const editor = page.getByRole('textbox', { name: 'Contenu Markdown' })
  await editor.waitFor()
  await page.evaluate(() => localStorage.removeItem('papier-scroll-sync'))
  const sections = Array.from({ length: 40 }, (_, i) => `## Section ${i + 1}\n\n` + `Paragraphe ${i + 1}. ` + 'Texte de contrôle. '.repeat(40)).join('\n\n')
  const markdown = '# Long\n\n' + sections + '\n\n```mermaid\nflowchart TD\n A --> \n```\n'
  await editor.focus()
  await editor.press('ControlOrMeta+a')
  await page.keyboard.insertText(markdown)
  await page.getByText('Aperçu à jour', { exact: false }).or(page.getByText('Erreur de rendu')).waitFor()
  await page.waitForFunction(() => document.querySelector('#print-document')?.getAttribute('aria-busy') === 'false')
  const editorScroller = page.locator('.cm-scroller')
  const previewScroller = page.locator('.preview-scroller')
  const fraction = (locator) => locator.evaluate(el => el.scrollTop / (el.scrollHeight - el.clientHeight))
  const heading = (n) => page.locator(`#print-document h2:has-text("Section ${n}")`).first()
  const topOffset = async (n) => (await heading(n).boundingBox()).y - (await previewScroller.boundingBox()).y

  // Editor → preview
  await editorScroller.evaluate(el => { el.scrollTop = el.scrollHeight / 2 })
  await page.waitForTimeout(400)
  const previewAfterEditor = await fraction(previewScroller)
  assert(previewAfterEditor > 0.3 && previewAfterEditor < 0.7, 'Preview did not follow editor: ' + previewAfterEditor)

  // Preview → editor
  await previewScroller.evaluate(el => { el.scrollTop = 0 })
  await page.waitForTimeout(400)
  assert(await editorScroller.evaluate(el => el.scrollTop) < 5, 'Editor did not follow preview to top')
  await previewScroller.evaluate(el => { el.scrollTop = (el.scrollHeight - el.clientHeight) * 0.75 })
  await page.waitForTimeout(400)
  const editorAfterPreview = await fraction(editorScroller)
  assert(editorAfterPreview > 0.5 && editorAfterPreview < 0.95, 'Editor did not follow preview: ' + editorAfterPreview)

  // Toggle off: no more following
  await page.getByRole('button', { name: 'Défilement lié' }).click()
  await editorScroller.evaluate(el => { el.scrollTop = 0 })
  await page.waitForTimeout(400)
  assert(await previewScroller.evaluate(el => el.scrollTop) > 100, 'Preview followed although sync is off')
  await page.getByRole('button', { name: 'Défilement lié' }).click()

  // Diagram error → editor line (fence is the line before "flowchart", error is relative to it)
  const lines = markdown.split('\n')
  const fence = lines.findIndex(line => line.startsWith('```mermaid')) + 1
  const jump = page.locator('.diagram-error-goto').first()
  await jump.scrollIntoViewIfNeeded()
  const label = await jump.textContent()
  const target = Number(label.match(/\d+/)[0])
  assert(target > fence, `Go-to-line target ${target} should be inside the fence starting at ${fence}`)
  await jump.click()
  await page.waitForFunction(() => document.activeElement?.closest('.cm-editor'))
  const selected = await page.evaluate(() => getSelection().toString())
  assert(selected.length > 0 && lines[target - 1].includes(selected.trim().slice(0, 5)), 'Editor selection is not the target line: ' + selected)
  console.log('PASS: synced scrolling both ways, toggle, diagram error jumps to its line')
}
