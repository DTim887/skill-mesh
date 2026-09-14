import {expect} from 'chai'
import {existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {createWorkspace} from '../../src/lib/workspace/create.js'

describe('workspace/create createWorkspace', () => {
  let root: string
  let templatePath: string

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'skillmesh-create-test-'))
    templatePath = path.join(root, 'template-SKILL.md')
    writeFileSync(templatePath, '# fixture skill template\n', 'utf8')
  })

  afterEach(() => {
    rmSync(root, {force: true, recursive: true})
  })

  it('creates both artifacts with correct content on success', async () => {
    const created = await createWorkspace(root, templatePath)

    expect(created.sort()).to.deep.equal(['.claude/skills/skillmesh/SKILL.md', '.skillmesh/registry.json'].sort())

    const registry = JSON.parse(readFileSync(path.join(root, '.skillmesh', 'registry.json'), 'utf8'))
    expect(registry).to.deep.equal({installed: [], 'schema_version': '1.0'})

    const skill = readFileSync(path.join(root, '.claude', 'skills', 'skillmesh', 'SKILL.md'), 'utf8')
    expect(skill).to.equal('# fixture skill template\n')
  })

  it('leaves no artifacts behind when the second rename fails, and rolls back the first', async () => {
    // Force the second rename (temp `claude/` dir -> `<root>/.claude`) to fail by making its
    // target already exist as a plain file — renaming a directory onto a file reliably fails
    // with ENOTDIR on POSIX, giving us a real (not mocked) mid-write failure to observe.
    writeFileSync(path.join(root, '.claude'), 'this occupies the rename target')

    let thrown: unknown
    try {
      await createWorkspace(root, templatePath)
    } catch (error) {
      thrown = error
    }

    expect(thrown).to.be.instanceOf(Error)
    expect((thrown as NodeJS.ErrnoException).code).to.equal('ENOTDIR')

    // The first rename must have been rolled back — no `.skillmesh` left behind.
    expect(existsSync(path.join(root, '.skillmesh'))).to.equal(false)

    // The pre-existing `.claude` file (not created by createWorkspace) is untouched — this
    // confirms createWorkspace didn't clobber it, only failed to rename over it.
    expect(readFileSync(path.join(root, '.claude'), 'utf8')).to.equal('this occupies the rename target')

    // No leftover temp staging directory.
    const leftoverTempDirs = readdirSync(root).filter((entry) => entry.startsWith('.skillmesh-init-'))
    expect(leftoverTempDirs).to.deep.equal([])
  })
})
