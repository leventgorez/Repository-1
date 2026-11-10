import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'prompt-master',
  component: 'Pane',
  requestId: 'prompt-master',
  props: {
    title: '✦ Prompt Master',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const BAND = {
  plugin: 'prompt-master',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 60,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const ANALYSIS = JSON.stringify({
  goal: 'Write a launch email',
  questions: [
    { question: 'Who will read this email?', options: ['Customers', 'Investors'] },
    { question: 'What tone do you want?', options: ['Friendly', 'Formal'] },
  ],
})
const BETTER =
  '<prompt>\nRole: You are a copywriter.\nTask: Write a launch email.\nContext: For customers. [fill this in: product name]\nFormat: 150 words, friendly.\nQuality check: No invented facts.\n</prompt>\n<note>Added audience and tone from your answers.</note>'

async function until<T>(f: () => Promise<T | undefined>): Promise<T> {
  for (let i = 0; i < 200; i++) {
    const v = await f()
    if (v !== undefined) return v
    await Promise.resolve()
  }
  throw new Error('timed out')
}

test('button -> questions -> better prompt -> Use this fills the box and never sends', async ($, on) => {
  const fills: string[] = []
  let submits = 0
  let calls = 0
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.read', () => ({ value: { text: 'write launch email for my app', cursor: 0 } }))
  on('prompt.fill', (_, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })
  on('prompt.submit', () => {
    submits++
    return { value: {} }
  })
  on('model.complete', () => {
    calls++
    const text = calls === 1 ? ANALYSIS : BETTER
    return { value: { isAnswered: true, text, usage: { input_tokens: 1, output_tokens: 1 } } }
  })

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await band.press({ key: 'pm-start' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await until(() => ui.find({ type: 'Text', text: /Who will read/ }))
  expect(await ui.find({ key: 'pm-q0-skip' })).toBeDefined()
  await ui.press({ key: 'pm-q0-o0' })
  await until(() => ui.find({ type: 'Text', text: /What tone/ }))
  await ui.input({ key: 'pm-q1-own', text: 'Playful but clear' })
  await until(() => ui.find({ type: 'Text', text: /Added audience/ }))
  expect(await ui.find({ type: 'Text', text: /fill this in: product name/ })).toBeDefined()
  expect(await ui.find({ key: 'pm-edit-btn' })).toBeDefined()
  expect(await ui.find({ key: 'pm-keep' })).toBeDefined()
  await ui.press({ key: 'pm-use' })
  await until(async () => (fills.length ? true : undefined))
  expect(fills[0]).toContain('Role: You are a copywriter.')
  expect(submits).toBe(0)
  await ui.unmount()
  await band.unmount()
})
