import {Errors} from '@oclif/core'
import {expect} from 'chai'
import {mkdirSync, mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {findWorkspaceRoot, resolveTargetRoot, validateName} from '../../src/lib/workspace/paths.js'

describe('workspace/paths', () => {
  describe('validateName', () => {
    it('accepts a simple name', () => {
      expect(validateName('myworkspace')).to.equal('myworkspace')
    })

    for (const bad of ['a/b', String.raw`a\b`, '..', '../foo', '/tmp/foo', 'foo/../bar']) {
      it(`rejects "${bad}"`, () => {
        expect(() => validateName(bad)).to.throw(Errors.CLIError)
        try {
          validateName(bad)
          expect.fail('expected validateName to throw')
        } catch (error) {
          expect((error as Errors.CLIError).oclif.exit).to.equal(2)
        }
      })
    }
  })

  describe('resolveTargetRoot', () => {
    it('returns cwd when no name is given', () => {
      expect(resolveTargetRoot('/tmp/cwd')).to.equal('/tmp/cwd')
    })

    it('joins cwd and name when a name is given', () => {
      expect(resolveTargetRoot('/tmp/cwd', 'myworkspace')).to.equal(path.join('/tmp/cwd', 'myworkspace'))
    })
  })

  describe('findWorkspaceRoot', () => {
    let base: string

    beforeEach(() => {
      base = mkdtempSync(path.join(tmpdir(), 'skillmesh-paths-test-'))
    })

    afterEach(() => {
      rmSync(base, {force: true, recursive: true})
    })

    it('finds a marker in the starting directory itself', () => {
      mkdirSync(path.join(base, '.skillmesh'))
      expect(findWorkspaceRoot(base)).to.equal(base)
    })

    it('finds a marker in an ancestor directory', () => {
      mkdirSync(path.join(base, '.skillmesh'))
      const nested = path.join(base, 'a', 'b', 'c')
      mkdirSync(nested, {recursive: true})
      expect(findWorkspaceRoot(nested)).to.equal(base)
    })

    it('returns undefined when no ancestor has a marker', () => {
      const nested = path.join(base, 'a', 'b')
      mkdirSync(nested, {recursive: true})
      expect(findWorkspaceRoot(nested)).to.equal(undefined)
    })
  })
})
