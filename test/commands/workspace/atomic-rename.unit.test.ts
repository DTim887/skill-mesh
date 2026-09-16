import {expect} from 'chai'
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {renameAllOrNothing} from '../../../src/lib/workspace/atomic-rename.js'

describe('workspace/atomicRename renameAllOrNothing', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'skillmesh-atomic-rename-test-'))
  })

  afterEach(() => {
    rmSync(root, {force: true, recursive: true})
  })

  it('renames every entry into place when all succeed', async () => {
    const tmpA = path.join(root, 'tmp-a')
    const tmpB = path.join(root, 'tmp-b')
    const tmpC = path.join(root, 'tmp-c')
    mkdirSync(tmpA)
    writeFileSync(path.join(tmpA, 'file.txt'), 'a', 'utf8')
    mkdirSync(tmpB)
    writeFileSync(path.join(tmpB, 'file.txt'), 'b', 'utf8')
    writeFileSync(tmpC, 'c', 'utf8')

    const finalA = path.join(root, 'nested', 'a')
    const finalB = path.join(root, 'b')
    const finalC = path.join(root, 'c.txt')

    await renameAllOrNothing([
      {finalPath: finalA, tmpPath: tmpA},
      {finalPath: finalB, tmpPath: tmpB},
      {finalPath: finalC, tmpPath: tmpC},
    ])

    expect(readFileSync(path.join(finalA, 'file.txt'), 'utf8')).to.equal('a')
    expect(readFileSync(path.join(finalB, 'file.txt'), 'utf8')).to.equal('b')
    expect(readFileSync(finalC, 'utf8')).to.equal('c')
  })

  it('creates missing parent directories for each final path', async () => {
    const tmpA = path.join(root, 'tmp-a')
    writeFileSync(tmpA, 'a', 'utf8')
    const finalA = path.join(root, 'deeply', 'nested', 'a.txt')

    await renameAllOrNothing([{finalPath: finalA, tmpPath: tmpA}])

    expect(readFileSync(finalA, 'utf8')).to.equal('a')
  })

  it('rolls back every already-completed rename when a later one fails, and leaves no partial state', async () => {
    const tmpA = path.join(root, 'tmp-a')
    const tmpB = path.join(root, 'tmp-b')
    const tmpC = path.join(root, 'tmp-c')
    mkdirSync(tmpA)
    mkdirSync(tmpB)
    mkdirSync(tmpC)

    const finalA = path.join(root, 'a')
    const finalB = path.join(root, 'b')
    const finalC = path.join(root, 'c')

    // Force the third (last) rename to fail with a real OS-level error: pre-occupy its target
    // with a plain file, so renaming a directory onto it fails with ENOTDIR — mirrors the
    // project's established "trigger a real failure, don't mock fs" approach.
    writeFileSync(finalC, 'this occupies the rename target')

    let thrown: unknown
    try {
      await renameAllOrNothing([
        {finalPath: finalA, tmpPath: tmpA},
        {finalPath: finalB, tmpPath: tmpB},
        {finalPath: finalC, tmpPath: tmpC},
      ])
    } catch (error) {
      thrown = error
    }

    expect(thrown).to.be.instanceOf(Error)
    expect((thrown as NodeJS.ErrnoException).code).to.equal('ENOTDIR')

    // The two renames that succeeded before the failure must have been rolled back.
    expect(existsSync(finalA)).to.equal(false)
    expect(existsSync(finalB)).to.equal(false)

    // The pre-existing file at finalC (not created by renameAllOrNothing) is untouched.
    expect(readFileSync(finalC, 'utf8')).to.equal('this occupies the rename target')
  })
})
