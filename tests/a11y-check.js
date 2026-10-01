async (page) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright')
  const assert = (value, message) => { if (!value) throw new Error(message) }
  const editor = page.getByRole('textbox', { name: 'Contenu Markdown' })
  await editor.waitFor()
  await page.locator('#print-document[aria-busy="false"]').waitFor({ state: 'attached' })
  const audit = async label => {
    // CodeMirror's scroller wraps a focusable contenteditable, which axe does not recognise.
    const { violations } = await new AxeBuilder({ page }).exclude('.cm-scroller').analyze()
    assert(!violations.length, `${label}: ${violations.map(v => `${v.id} (${v.nodes.map(n => n.target.join(' ')).join(', ')})`).join('; ')}`)
  }
  for (const [label, width, appearance] of [['desktop clair', 1440, 'light'], ['desktop sombre', 1440, 'dark'], ['mobile', 390, 'light']]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(value => { document.documentElement.dataset.appearance = value }, appearance)
    await page.waitForTimeout(300)
    await audit(label)
  }
  // Tab order only reaches visible controls.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => { document.documentElement.dataset.appearance = 'light'; document.body.focus() })
  for (let index = 0; index < 40; index++) {
    await page.keyboard.press('Tab')
    const hidden = await page.evaluate(() => document.activeElement?.type === 'file')
    assert(!hidden, 'Tab reached a hidden file input')
  }
  console.log('PASS: axe audit (light, dark, mobile), no hidden tab stops')
}
