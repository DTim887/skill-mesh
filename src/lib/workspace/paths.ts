import {Errors} from '@oclif/core'
import {existsSync} from 'node:fs'
import path from 'node:path'

const INVALID_NAME_MESSAGE = '只支持当前目录下的简单子目录名，不支持包含路径分隔符、".." 或绝对路径'

export function validateName(name: string): string {
  const hasSeparator = name.includes('/') || name.includes('\\')
  const isParentRef = name === '..' || name.split(/[/\\]/).includes('..')
  const isAbsolute = path.isAbsolute(name)

  if (hasSeparator || isParentRef || isAbsolute) {
    throw new Errors.CLIError(INVALID_NAME_MESSAGE, {code: 'INIT_INVALID_NAME', exit: 2})
  }

  return name
}

export function resolveTargetRoot(cwd: string, name?: string): string {
  return name ? path.join(cwd, name) : cwd
}

export function findWorkspaceRoot(startDir: string): string | undefined {
  let dir = path.resolve(startDir)

  for (;;) {
    if (isWorkspaceMarked(dir)) {
      return dir
    }

    const parent = path.dirname(dir)
    if (parent === dir) {
      return undefined
    }

    dir = parent
  }
}

export function isWorkspaceMarked(dir: string): boolean {
  return existsSync(path.join(dir, '.skillmesh'))
}
