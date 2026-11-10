# ✦ Prompt Master

A Claude Code mod that improves your rough prompt before you send it. It never sends anything on its own: you always press send yourself.

## Use it

- Type a rough prompt in the prompt box, then press **✦ Prompt Master** (the button just above the prompt box), or
- type `/prompt-master <your rough prompt>` and press Enter.

Prompt Master reads your prompt and asks up to 3 short questions (who it's for, what a great result looks like, format and length), one at a time. Each question has buttons, **Skip**, and a box for your own answer. It skips the questions your prompt already answers.

It then rewrites your prompt as **Role / Task / Context / Format / Quality check**. It keeps your words where they work, never invents facts, and marks anything still unknown as `[fill this in: ...]`. The better prompt is shown above your original, with a one-line note on what changed, and three buttons:

- **Use this** puts it in your prompt box (it is not sent)
- **Edit** lets you change it first
- **Keep mine** closes the panel

## Install

Copy this folder into a plugin folder Claude Code loads (for example with `claude --plugin-dir ./prompt-master`).
