import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PmFlow, PmQuestion } from '../types'

const PANE = 'prompt-master'
const TITLE = '✦ Prompt Master'
const flow = atom({ plugin: 'prompt-master', key: 'flow' } as const, { step: 'idle' } as PmFlow, {
  shape: 'flow-1',
})

// ---------- model prompts ----------

const ANALYZE_SYSTEM = `You help a person improve a rough prompt they are about to send to an AI assistant.
Read the rough prompt and work out what they are actually trying to get done.
Then check whether the prompt already answers these three things:
  1. audience: who is this for, or where will it be used?
  2. success: what would a great result look like (an example, a tone, a goal)?
  3. format: what format and length do they want?
For each one that is missing AND would really change the answer, write ONE short question (max 12 words)
with 2 or 3 short, likely answers as options (max 5 words each), tailored to this prompt.
Ask at most 3 questions, in the order above. If the prompt already answers them, or the prompt is trivial, ask none.
Reply with JSON only, no prose, no code fences:
{"goal":"<one sentence>","questions":[{"question":"...","options":["...","..."]}]}`

const OPTIMIZE_SYSTEM = `You rewrite a person's rough prompt into a better prompt for an AI assistant. You do NOT answer it.
Use exactly this structure, with these headings on their own lines:
Role: who the assistant should act as for this task
Task: exactly what to do, in one or two clear sentences
Context: who it is for, the details that matter, and the person's answers to the clarifying questions
Format: length, structure (list, table, steps, paragraphs) and tone
Quality check: what the assistant should double-check before answering

Rules:
- Keep the person's meaning and their own words wherever they already work.
- Never invent facts about the person, their business, their numbers, names or dates.
- Anything important that is still unknown: write it as [fill this in: ...] so they can see it.
- Write the prompt in the same language as the rough prompt.
- Keep it tight: no filler, no preamble.

Reply in exactly this form and nothing else:
<prompt>
...the improved prompt...
</prompt>
<note>one line (max 20 words) on what you changed and why</note>`

async function ask($: EngineInterface, model: string, system: string, prompt: string, maxTokens: number) {
  const r = await $.model.complete({ model, system, prompt, maxTokens, effort: 'low' })
  if (!r.isAnswered) {
    throw new Error(r.reason === 'api-error' ? `the model call failed (${r.status ?? 'error'})` : r.reason)
  }
  return r.text
}

function parseAnalysis(text: string): { goal: string; questions: PmQuestion[] } {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as {
      goal?: unknown
      questions?: { question?: unknown; options?: unknown }[]
    }
    const questions = (Array.isArray(raw.questions) ? raw.questions : [])
      .filter(q => typeof q?.question === 'string' && q.question.trim() !== '')
      .slice(0, 3)
      .map(q => ({
        question: String(q.question).trim(),
        options: (Array.isArray(q.options) ? q.options : [])
          .filter((o): o is string => typeof o === 'string' && o.trim() !== '')
          .map(o => o.trim())
          .slice(0, 3),
      }))
    return { goal: typeof raw.goal === 'string' ? raw.goal : '', questions }
  } catch {
    return { goal: '', questions: [] }
  }
}

function parseOptimized(text: string): { improved: string; note: string } {
  const p = /<prompt>\s*([\s\S]*?)\s*<\/prompt>/.exec(text)
  const n = /<note>\s*([\s\S]*?)\s*<\/note>/.exec(text)
  const improved = (p?.[1] ?? text.replace(/<note>[\s\S]*$/, '')).trim()
  return { improved, note: (n?.[1] ?? 'Restructured into Role, Task, Context, Format and Quality check.').trim() }
}

// ---------- the flow ----------

let runs = 0

async function current($: EngineInterface, run: number) {
  const f = await read($, flow)
  return f.step !== 'idle' && f.run === run
}

async function fail($: EngineInterface, run: number, original: string, err: unknown) {
  if (!(await current($, run))) return
  const message = err instanceof Error ? err.message : String(err)
  await update($, flow, (): PmFlow => ({ step: 'error', run, original, message }))
}

async function optimize(
  $: EngineInterface,
  run: number,
  original: string,
  goal: string,
  answers: { question: string; answer: string }[],
) {
  await update($, flow, (): PmFlow => ({ step: 'writing', run, original }))
  const answered = answers.filter(a => a.answer !== '')
  const prompt = [
    `Rough prompt:\n"""\n${original}\n"""`,
    goal ? `What they seem to want: ${goal}` : '',
    answered.length
      ? `Their answers to clarifying questions:\n${answered.map(a => `- ${a.question} -> ${a.answer}`).join('\n')}`
      : 'They gave no extra answers.',
  ]
    .filter(Boolean)
    .join('\n\n')
  try {
    const { improved, note } = parseOptimized(await ask($, 'sonnet', OPTIMIZE_SYSTEM, prompt, 2000))
    if (!(await current($, run))) return
    await update($, flow, (): PmFlow => ({
      step: 'result',
      run,
      original,
      improved,
      note,
      isEditing: false,
      draft: improved,
    }))
  } catch (err) {
    await fail($, run, original, err)
  }
}

async function start($: EngineInterface, original: string) {
  const run = ++runs
  await update($, flow, (): PmFlow => ({ step: 'reading', run, original }))
  void $.ui.open({ id: PANE, title: TITLE, focus: true, closeOnEscape: true })
  try {
    const { goal, questions } = parseAnalysis(
      await ask($, 'haiku', ANALYZE_SYSTEM, `Rough prompt:\n"""\n${original}\n"""`, 600),
    )
    if (!(await current($, run))) return
    if (questions.length === 0) {
      await optimize($, run, original, goal, [])
      return
    }
    await update($, flow, (): PmFlow => ({ step: 'asking', run, original, goal, questions, index: 0, answers: [] }))
  } catch (err) {
    await fail($, run, original, err)
  }
}

async function answer($: EngineInterface, run: number, value: string) {
  const f = await read($, flow)
  if (f.step !== 'asking' || f.run !== run) return
  const q = f.questions[f.index]
  if (!q) return
  const answers = [...f.answers, { question: q.question, answer: value.trim() }]
  if (f.index + 1 < f.questions.length) {
    await update($, flow, (): PmFlow => ({ ...f, index: f.index + 1, answers }))
    return
  }
  await optimize($, run, f.original, f.goal, answers)
}

async function close($: EngineInterface) {
  await update($, flow, (): PmFlow => ({ step: 'idle' }))
  await $.ui.close({ id: PANE })
}

// Fills the prompt box only. Never submits: the person presses send.
async function use($: EngineInterface, text: string) {
  const r = await $.prompt.fill({ text, mode: 'replace' })
  await close($)
  $.ui.toast(r.isFilled ? 'Better prompt is in your prompt box. Press send when ready.' : 'Could not reach the prompt box.')
}

async function startFromBox($: EngineInterface) {
  const box = await $.prompt.read()
  const text = box.text.replace(/^\s*\/prompt-master\b/, '').trim()
  if (text === '') {
    $.ui.toast('Type a rough prompt first, then press ✦ Prompt Master.')
    return
  }
  await start($, text)
}

export const register: Register = on => {
  // ---------- slash command ----------

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'prompt-master',
      description: 'Improve the prompt that follows before you send it (e.g. /prompt-master write a launch email)',
    })
    return next(e)
  })

  on('command.run', { command: 'prompt-master' }, async ($, e) => {
    const text = e.args.trim()
    if (text === '') {
      return { text: 'Type your rough prompt after the command, e.g. /prompt-master write a launch email for my app' }
    }
    // Put the rough prompt back in the box so nothing is lost, then start.
    void $.prompt.fill({ text, mode: 'replace' })
    void start($, text)
    return { text: '✦ Prompt Master is improving your prompt…' }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) await update($, flow, (): PmFlow => ({ step: 'idle' }))
    return next(e)
  })

  // ---------- the button above the prompt box ----------

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.isWorking) return next(e)
    const f = await read($, flow)
    const { Box, Button } = $.ui.resolve(e)
    return (
      <Box>
        <Button
          key="pm-start"
          label={f.step === 'idle' ? '✦ Prompt Master' : '✦ Prompt Master (working…)'}
          dimColor={f.step !== 'idle'}
          onPress={() => {
            if (f.step === 'idle' || f.step === 'error') void startFromBox($)
            else void $.ui.open({ id: PANE, title: TITLE, focus: true, closeOnEscape: true })
          }}
        />
      </Box>
    )
  })

  // ---------- the panel ----------

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const f = await read($, flow)

    if (f.step === 'idle') {
      return (
        <Box flexDirection="column">
          <Text dimColor>Type a rough prompt, then press ✦ Prompt Master or type /prompt-master before it.</Text>
        </Box>
      )
    }

    if (f.step === 'reading' || f.step === 'writing') {
      return (
        <Box flexDirection="column">
          <Text dimColor>{f.step === 'reading' ? 'Reading your prompt…' : 'Writing a better prompt…'}</Text>
          <Button key="pm-cancel" label="Cancel" dimColor onPress={() => void close($)} />
        </Box>
      )
    }

    if (f.step === 'error') {
      return (
        <Box flexDirection="column">
          <Text>Something went wrong: {f.message}</Text>
          <Box flexDirection="row" gap={1}>
            <Button key="pm-retry" label="Try again" variant="primary" onPress={() => void start($, f.original)} />
            <Button key="pm-close" label="Keep mine" role="dismiss" onPress={() => void close($)} />
          </Box>
        </Box>
      )
    }

    if (f.step === 'asking') {
      const q = f.questions[f.index]
      if (!q) return <Text dimColor>…</Text>
      return (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>
            Question {f.index + 1} of {f.questions.length}
          </Text>
          <Text bold>{q.question}</Text>
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {q.options.map((o, i) => (
              <Button key={`pm-q${f.index}-o${i}`} label={o} hotkey={String(i + 1)} onPress={() => void answer($, f.run, o)} />
            ))}
            <Button key={`pm-q${f.index}-skip`} label="Skip" hotkey="s" dimColor onPress={() => void answer($, f.run, '')} />
          </Box>
          <Input
            key={`pm-q${f.index}-own`}
            placeholder="Or type your own answer and press Enter"
            submitLabel="answer"
            onSubmit={v => void answer($, f.run, v)}
          />
        </Box>
      )
    }

    // result
    if (f.isEditing) {
      return (
        <Box flexDirection="column" gap={1}>
          <Text bold>Edit the better prompt</Text>
          <Input
            key="pm-edit"
            rows={12}
            value={f.draft}
            autoFocus
            submitLabel="use this"
            onInput={v => void update($, flow, (cur): PmFlow => (cur.step === 'result' ? { ...cur, draft: v } : cur))}
            onSubmit={v => void use($, v)}
          />
          <Box flexDirection="row" gap={1}>
            <Button key="pm-use-edited" label="Use this" variant="primary" onPress={() => void use($, f.draft)} />
            <Button
              key="pm-edit-back"
              label="Back"
              onPress={() => void update($, flow, (cur): PmFlow => (cur.step === 'result' ? { ...cur, isEditing: false } : cur))}
            />
            <Button key="pm-keep2" label="Keep mine" role="dismiss" onPress={() => void close($)} />
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Text color="green">✦ {f.note}</Text>
        <Text bold>Better prompt</Text>
        <Box borderStyle="round" paddingX={1} flexDirection="column">
          <Text>{f.improved}</Text>
        </Box>
        <Box flexDirection="row" gap={1}>
          <Button key="pm-use" label="Use this" hotkey="u" variant="primary" autoFocus onPress={() => void use($, f.improved)} />
          <Button
            key="pm-edit-btn"
            label="Edit"
            hotkey="e"
            onPress={() => void update($, flow, (cur): PmFlow => (cur.step === 'result' ? { ...cur, isEditing: true, draft: cur.improved } : cur))}
          />
          <Button key="pm-keep" label="Keep mine" hotkey="k" role="dismiss" onPress={() => void close($)} />
        </Box>
        <Text dimColor>Your original</Text>
        <Text dimColor>{f.original}</Text>
      </Box>
    )
  })
}
