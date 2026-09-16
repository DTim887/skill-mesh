import {Errors} from '@oclif/core'
import {expect} from 'chai'
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {
  appendInstalledRecord,
  findInstalledRecord,
  isDomainInstalled,
  readRegistry,
  removeInstalledRecord,
} from '../../../src/lib/domain/registry.js'
import {SKILL_TARGETS} from '../../../src/lib/skill-targets.js'

const INITIAL_REGISTRY = `${JSON.stringify({installed: [], 'schema_version': '1.0'}, null, 2)}\n`

function seedInstalledOrdering(root: string, files: string[]) {
  const registry = {
    installed: [
      {
        files,
        id: 'ordering',
        'installed_at': '2026-09-16T00:00:00Z',
        repository: 'https://github.com/DTim887/skill-mesh-ordering',
        type: 'domain',
        version: '1.0.0',
      },
    ],
    'schema_version': '1.0',
  }
  writeFileSync(path.join(root, '.skillmesh', 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
}

describe('domain/registry', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'skillmesh-registry-test-'))
    mkdirSync(path.join(root, '.skillmesh'))
    writeFileSync(path.join(root, '.skillmesh', 'registry.json'), INITIAL_REGISTRY, 'utf8')
  })

  afterEach(() => {
    // In case a failing test left `.skillmesh` read-only, restore write permission before
    // recursive removal so cleanup itself doesn't fail.
    chmodSync(path.join(root, '.skillmesh'), 0o755)
    rmSync(root, {force: true, recursive: true})
  })

  describe('readRegistry / isDomainInstalled', () => {
    it('reads the initial empty registry', async () => {
      const registry = await readRegistry(root)
      expect(registry.installed).to.deep.equal([])
    })

    it('reports a domain as not installed when absent', async () => {
      const registry = await readRegistry(root)
      expect(isDomainInstalled(registry, 'ordering')).to.equal(false)
    })

    it('reports a domain as installed when its id is present', async () => {
      const registry = await readRegistry(root)
      registry.installed.push({
        files: ['.claude/skills/ordering-knowledge/SKILL.md'],
        id: 'ordering',
        'installed_at': '2026-09-16T00:00:00Z',
        repository: 'https://github.com/DTim887/skill-mesh-ordering',
        type: 'domain',
        version: '1.0.0',
      })
      expect(isDomainInstalled(registry, 'ordering')).to.equal(true)
    })

    it('throws a friendly CLIError instead of a raw SyntaxError when registry.json is not valid JSON', async () => {
      writeFileSync(path.join(root, '.skillmesh', 'registry.json'), 'not valid json', 'utf8')

      try {
        await readRegistry(root)
        expect.fail('expected readRegistry to throw')
      } catch (error) {
        expect(error).to.be.instanceOf(Errors.CLIError)
        expect((error as Errors.CLIError).message).to.equal('安装记录异常，请联系维护者')
        expect((error as Errors.CLIError).oclif.exit).to.equal(1)
      }
    })
  })

  describe('findInstalledRecord', () => {
    it('returns the record whose id matches', async () => {
      const registry = await readRegistry(root)
      registry.installed.push({
        files: ['.claude/skills/ordering-knowledge/SKILL.md'],
        id: 'ordering',
        'installed_at': '2026-09-16T00:00:00Z',
        repository: 'https://github.com/DTim887/skill-mesh-ordering',
        type: 'domain',
        version: '1.0.0',
      })
      expect(findInstalledRecord(registry, 'ordering')?.id).to.equal('ordering')
    })

    it('returns undefined when no record matches', async () => {
      const registry = await readRegistry(root)
      expect(findInstalledRecord(registry, 'does-not-exist')).to.equal(undefined)
    })
  })

  describe('appendInstalledRecord', () => {
    it('writes the skill file to every target and appends the registry record on success', async () => {
      await appendInstalledRecord(
        root,
        {
          files: [
            '.claude/skills/ordering-knowledge/SKILL.md',
            '.cursor/skills/ordering-knowledge/SKILL.md',
          ],
          id: 'ordering',
          'installed_at': '2026-09-16T00:00:00Z',
          repository: 'https://github.com/DTim887/skill-mesh-ordering',
          type: 'domain',
          version: '1.0.0',
        },
        SKILL_TARGETS,
        {content: '# fixture skill content\n', dirName: 'ordering-knowledge'},
      )

      const claudePath = path.join(root, '.claude', 'skills', 'ordering-knowledge', 'SKILL.md')
      const cursorPath = path.join(root, '.cursor', 'skills', 'ordering-knowledge', 'SKILL.md')
      expect(existsSync(claudePath)).to.equal(true)
      expect(existsSync(cursorPath)).to.equal(true)
      expect(readFileSync(claudePath, 'utf8')).to.equal('# fixture skill content\n')
      expect(readFileSync(cursorPath, 'utf8')).to.equal(readFileSync(claudePath, 'utf8'))

      const registry = JSON.parse(readFileSync(path.join(root, '.skillmesh', 'registry.json'), 'utf8'))
      expect(registry.installed).to.have.lengthOf(1)
      expect(registry.installed[0].id).to.equal('ordering')
      expect(registry.installed[0].files).to.deep.equal([
        '.claude/skills/ordering-knowledge/SKILL.md',
        '.cursor/skills/ordering-knowledge/SKILL.md',
      ])
    })

    it('rolls back every target directory and does not touch the existing registry when the final rename fails', async () => {
      // Force the last rename (temp registry.json -> real registry.json) to fail with a real,
      // deterministic OS-level error: strip write permission from `.skillmesh/` so renaming
      // *into* it is rejected (EACCES), while reading the existing registry.json still succeeds
      // (read + directory search permission is untouched) — mirrors the project's established
      // "trigger a real failure, don't mock fs" testing approach.
      chmodSync(path.join(root, '.skillmesh'), 0o555)

      let thrown: unknown
      try {
        await appendInstalledRecord(
          root,
          {
            files: [
              '.claude/skills/ordering-knowledge/SKILL.md',
              '.cursor/skills/ordering-knowledge/SKILL.md',
            ],
            id: 'ordering',
            'installed_at': '2026-09-16T00:00:00Z',
            repository: 'https://github.com/DTim887/skill-mesh-ordering',
            type: 'domain',
            version: '1.0.0',
          },
          SKILL_TARGETS,
          {content: '# fixture skill content\n', dirName: 'ordering-knowledge'},
        )
      } catch (error) {
        thrown = error
      } finally {
        chmodSync(path.join(root, '.skillmesh'), 0o755)
      }

      expect(thrown).to.be.instanceOf(Error)
      expect((thrown as NodeJS.ErrnoException).code).to.equal('EACCES')

      // Both target directories (not just one) must have been rolled back.
      expect(existsSync(path.join(root, '.claude', 'skills', 'ordering-knowledge'))).to.equal(false)
      expect(existsSync(path.join(root, '.cursor', 'skills', 'ordering-knowledge'))).to.equal(false)

      // The original registry.json is untouched.
      expect(readFileSync(path.join(root, '.skillmesh', 'registry.json'), 'utf8')).to.equal(INITIAL_REGISTRY)

      // No leftover temp staging directory.
      const leftoverTempDirs = readdirSync(root).filter((entry) => entry.startsWith('.skillmesh-add-'))
      expect(leftoverTempDirs).to.deep.equal([])
    })
  })

  describe('removeInstalledRecord', () => {
    it('throws a friendly CLIError when the id has no installed record', async () => {
      try {
        await removeInstalledRecord(root, 'does-not-exist')
        expect.fail('expected removeInstalledRecord to throw')
      } catch (error) {
        expect(error).to.be.instanceOf(Errors.CLIError)
        expect((error as Errors.CLIError).message).to.equal('未安装：does-not-exist')
        expect((error as Errors.CLIError).oclif.exit).to.equal(11)
      }
    })

    it('deletes every file, cleans up now-empty leaf directories, and removes the registry record', async () => {
      const claudeDir = path.join(root, '.claude', 'skills', 'ordering-knowledge')
      const cursorDir = path.join(root, '.cursor', 'skills', 'ordering-knowledge')
      mkdirSync(claudeDir, {recursive: true})
      mkdirSync(cursorDir, {recursive: true})
      writeFileSync(path.join(claudeDir, 'SKILL.md'), 'claude content', 'utf8')
      writeFileSync(path.join(cursorDir, 'SKILL.md'), 'cursor content', 'utf8')
      seedInstalledOrdering(root, [
        '.claude/skills/ordering-knowledge/SKILL.md',
        '.cursor/skills/ordering-knowledge/SKILL.md',
      ])

      const deleted = await removeInstalledRecord(root, 'ordering')

      expect(deleted.sort()).to.deep.equal(
        ['.claude/skills/ordering-knowledge/SKILL.md', '.cursor/skills/ordering-knowledge/SKILL.md'].sort(),
      )
      expect(existsSync(claudeDir)).to.equal(false)
      expect(existsSync(cursorDir)).to.equal(false)

      const registry = JSON.parse(readFileSync(path.join(root, '.skillmesh', 'registry.json'), 'utf8'))
      expect(registry.installed).to.deep.equal([])
    })

    it('tolerates a file that is already missing on disk, without erroring', async () => {
      const claudeDir = path.join(root, '.claude', 'skills', 'ordering-knowledge')
      mkdirSync(claudeDir, {recursive: true})
      writeFileSync(path.join(claudeDir, 'SKILL.md'), 'claude content', 'utf8')
      // The Cursor file is listed in the record but never actually created on disk.
      seedInstalledOrdering(root, [
        '.claude/skills/ordering-knowledge/SKILL.md',
        '.cursor/skills/ordering-knowledge/SKILL.md',
      ])

      const deleted = await removeInstalledRecord(root, 'ordering')

      expect(deleted).to.deep.equal(['.claude/skills/ordering-knowledge/SKILL.md'])
      expect(existsSync(claudeDir)).to.equal(false)

      const registry = JSON.parse(readFileSync(path.join(root, '.skillmesh', 'registry.json'), 'utf8'))
      expect(registry.installed).to.deep.equal([])
    })

    it('deletes the known file but preserves a leaf directory that still has other content', async () => {
      const claudeDir = path.join(root, '.claude', 'skills', 'ordering-knowledge')
      mkdirSync(claudeDir, {recursive: true})
      writeFileSync(path.join(claudeDir, 'SKILL.md'), 'claude content', 'utf8')
      writeFileSync(path.join(claudeDir, 'my-note.txt'), 'user content', 'utf8')
      seedInstalledOrdering(root, ['.claude/skills/ordering-knowledge/SKILL.md'])

      const deleted = await removeInstalledRecord(root, 'ordering')

      expect(deleted).to.deep.equal(['.claude/skills/ordering-knowledge/SKILL.md'])
      expect(existsSync(path.join(claudeDir, 'SKILL.md'))).to.equal(false)
      expect(existsSync(path.join(claudeDir, 'my-note.txt'))).to.equal(true)
    })

    it('does not update the registry when deleting a file that genuinely fails (not merely missing)', async () => {
      const claudeDir = path.join(root, '.claude', 'skills', 'ordering-knowledge')
      mkdirSync(claudeDir, {recursive: true})
      writeFileSync(path.join(claudeDir, 'SKILL.md'), 'claude content', 'utf8')
      seedInstalledOrdering(root, ['.claude/skills/ordering-knowledge/SKILL.md'])

      // Force a real, deterministic OS-level failure: removing write permission from the leaf
      // directory means unlinking a file inside it fails with EACCES (POSIX requires write
      // permission on the *containing* directory, not the file itself, to remove a directory
      // entry) — mirrors the project's established "trigger a real failure, don't mock fs"
      // testing approach.
      chmodSync(claudeDir, 0o555)

      let thrown: unknown
      try {
        await removeInstalledRecord(root, 'ordering')
      } catch (error) {
        thrown = error
      } finally {
        chmodSync(claudeDir, 0o755)
      }

      expect(thrown).to.be.instanceOf(Error)
      expect((thrown as NodeJS.ErrnoException).code).to.equal('EACCES')

      // The file was never actually removed (the permission block prevented it), and the
      // registry record must be untouched — a retry will find the same state and can proceed
      // once the permission problem is fixed.
      expect(existsSync(path.join(claudeDir, 'SKILL.md'))).to.equal(true)
      const registry = JSON.parse(readFileSync(path.join(root, '.skillmesh', 'registry.json'), 'utf8'))
      expect(registry.installed).to.have.lengthOf(1)
      expect(registry.installed[0].id).to.equal('ordering')
    })
  })
})
