import {createInterface} from 'node:readline'

export type Ask = (question: string) => Promise<string>

// `node:readline/promises` would give a Promise-native `.question()` directly, but the project's
// `engines.node` range (`>=20.0.0`) predates the version where that module left experimental
// status — using the plain callback-based `node:readline` and wrapping it ourselves avoids
// depending on an experimental API for something this simple.
const realDefaultAsk: Ask = async (question) => {
  const rl = createInterface({input: process.stdin, output: process.stdout})
  try {
    return await new Promise<string>((resolve) => {
      rl.question(question, resolve)
    })
  } finally {
    rl.close()
  }
}

const realIsInteractiveTerminal = (): boolean => Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY)

let currentAsk: Ask = realDefaultAsk
let currentIsInteractiveTerminal: () => boolean = realIsInteractiveTerminal

// `@oclif/test`'s `runCommand()` instantiates commands itself, so tests have no constructor seam
// to inject a fake `Ask`/TTY check through. These setters give tests a way to swap the module's
// own internal binding instead — this works in ESM (unlike reassigning a property on someone
// else's imported namespace object, which is frozen) because the mutation happens inside this
// module via its own exported functions, not from outside.
export function setAsk(ask: Ask): void {
  currentAsk = ask
}

export function resetAsk(): void {
  currentAsk = realDefaultAsk
}

export function setInteractiveTerminalOverride(check: () => boolean): void {
  currentIsInteractiveTerminal = check
}

export function resetInteractiveTerminalOverride(): void {
  currentIsInteractiveTerminal = realIsInteractiveTerminal
}

export function isInteractiveTerminal(): boolean {
  return currentIsInteractiveTerminal()
}

export async function confirmYesNo(question: string): Promise<boolean> {
  const answer = await currentAsk(question)
  return answer.trim().toLowerCase() === 'y'
}
