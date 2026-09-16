import {expect} from 'chai'
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {appendInstalledRecord, isDomainInstalled, readRegistry} from '../../../src/lib/domain/registry.js'

const INITIAL_REGISTRY = `${JSON.stringify({installed: [], 'schema_version': '1.0'}, null, 2)}\n`

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
  })

  describe('appendInstalledRecord', () => {
    it('writes the skill file and appends the registry record on success', async () => {
      await appendInstalledRecord(
        root,
        {
          files: ['.claude/skills/ordering-knowledge/SKILL.md'],
          id: 'ordering',
          'installed_at': '2026-09-16T00:00:00Z',
          repository: 'https://github.com/DTim887/skill-mesh-ordering',
          type: 'domain',
          version: '1.0.0',
        },
        'ordering-knowledge',
        '# fixture skill content\n',
      )

      const skillPath = path.join(root, '.claude', 'skills', 'ordering-knowledge', 'SKILL.md')
      expect(existsSync(skillPath)).to.equal(true)
      expect(readFileSync(skillPath, 'utf8')).to.equal('# fixture skill content\n')

      const registry = JSON.parse(readFileSync(path.join(root, '.skillmesh', 'registry.json'), 'utf8'))
      expect(registry.installed).to.have.lengthOf(1)
      expect(registry.installed[0].id).to.equal('ordering')
    })

    it('leaves no artifacts behind and does not touch the existing registry when the second rename fails', async () => {
      // Force the second rename (temp registry.json -> real registry.json) to fail with a real,
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
            files: ['.claude/skills/ordering-knowledge/SKILL.md'],
            id: 'ordering',
            'installed_at': '2026-09-16T00:00:00Z',
            repository: 'https://github.com/DTim887/skill-mesh-ordering',
            type: 'domain',
            version: '1.0.0',
          },
          'ordering-knowledge',
          '# fixture skill content\n',
        )
      } catch (error) {
        thrown = error
      } finally {
        chmodSync(path.join(root, '.skillmesh'), 0o755)
      }

      expect(thrown).to.be.instanceOf(Error)
      expect((thrown as NodeJS.ErrnoException).code).to.equal('EACCES')

      // The skill directory rename must have been rolled back.
      expect(existsSync(path.join(root, '.claude', 'skills', 'ordering-knowledge'))).to.equal(false)

      // The original registry.json is untouched.
      expect(readFileSync(path.join(root, '.skillmesh', 'registry.json'), 'utf8')).to.equal(INITIAL_REGISTRY)

      // No leftover temp staging directory.
      const leftoverTempDirs = readdirSync(root).filter((entry) => entry.startsWith('.skillmesh-add-'))
      expect(leftoverTempDirs).to.deep.equal([])
    })
  })
})
