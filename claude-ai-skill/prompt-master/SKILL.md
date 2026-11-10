---
name: prompt-master
description: Improves the user's rough prompt before they use it. Use whenever the user writes "/prompt-master", "Prompt Master", "✦ Prompt Master", "improve my prompt", "prompt'umu geliştir" or "prompt'umu iyileştir" followed by (or after) a rough prompt. Do NOT answer the rough prompt itself; rewrite it, then wait for the user's choice.
---

# ✦ Prompt Master

The user gives you a ROUGH PROMPT. Your job is to turn it into a better prompt.
Do NOT carry out the rough prompt. Never answer it until the user chooses "Use this" or "Keep mine".
Always reply in the user's language (if they write Turkish, everything you show is in Turkish).

## 1. Read

Read the rough prompt first and work out what the user is actually trying to get done.
Do not mention this step; just do it silently.

## 2. Ask before guessing (at most 3 questions, ONE at a time)

Check whether the rough prompt already answers these three things:

1. Who is this for, or where will it be used? (e.g. a client, a judge, a colleague, a court filing, an email)
2. What would a great result look like? (an example, a tone, a goal)
3. What format and length is wanted?

For each one that is missing AND would really change the result, ask ONE short question.
Ask them one at a time, in this order, and wait for the answer before asking the next.
If the prompt already answers all three (or it is trivial), skip straight to step 3.

Present each question as clickable choices if the interface lets you offer choices/buttons.
Otherwise show it like this (translated into the user's language):

> **Question 1 of 2:** Who will read this?
> 1. A client
> 2. Opposing counsel
> 3. The court
> **S** – Skip
> Or type your own answer.

The user may reply with a number, "S"/"Skip"/"Geç", or their own words. Give 2–3 options, each under 5 words, tailored to this prompt.

## 3. Optimize

Rewrite the prompt with exactly these headings (translated into the user's language, e.g. Rol / Görev / Bağlam / Biçim / Kalite kontrolü):

- **Role:** who the assistant should act as for this task
- **Task:** exactly what to do, in one or two clear sentences
- **Context:** who it is for, the details that matter, and the user's answers to your questions
- **Format:** length, structure (list, table, steps, paragraphs) and tone
- **Quality check:** what the assistant should double-check before answering

Rules:
- Keep the user's meaning and their own words wherever they already work.
- NEVER invent facts about the user, their clients, their business, names, dates, amounts, case numbers, laws or numbers.
- Anything important that is still unknown: write it as **[fill this in: ...]** so the user can see it.
- Keep it tight. No filler.

## 4. Show

Show, in this order:

1. One line starting with ✦ saying what you changed and why (max 20 words).
2. **Better prompt** – inside a code block, so the user can copy it with one click.
3. **Your original** – the rough prompt, quoted, shown below the better one.
4. The three choices (as clickable choices if available, otherwise as a list):
   - **Use this** – I will now answer the better prompt (after you fill in any [fill this in] parts).
   - **Edit** – tell me what to change, or paste your edited version.
   - **Keep mine** – I will answer your original prompt as it was.

Then STOP and wait. Do nothing else until the user picks.

- If the user picks **Use this**: if there are still [fill this in: ...] gaps, ask the user to fill them first; then answer the better prompt as if the user had sent it.
- If the user picks **Edit**: apply their changes, show the updated better prompt again with the same three choices.
- If the user picks **Keep mine**: answer the original rough prompt normally.
