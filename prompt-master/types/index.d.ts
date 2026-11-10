export type PmQuestion = { question: string; options: string[] }

export type PmFlow =
  | { step: 'idle' }
  | { step: 'reading'; run: number; original: string }
  | {
      step: 'asking'
      run: number
      original: string
      goal: string
      questions: PmQuestion[]
      index: number
      answers: { question: string; answer: string }[]
    }
  | { step: 'writing'; run: number; original: string }
  | {
      step: 'result'
      run: number
      original: string
      improved: string
      note: string
      isEditing: boolean
      draft: string
    }
  | { step: 'error'; run: number; original: string; message: string }

declare module 'claude-code' {
  interface PluginState {
    'prompt-master': { flow: Shaped<PmFlow> }
  }
}
