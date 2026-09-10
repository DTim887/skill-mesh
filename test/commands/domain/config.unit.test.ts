import {expect} from 'chai'

import {getCatalogConfig} from '../../../src/lib/domain/config.js'

describe('domain/config getCatalogConfig', () => {
  it('falls back to the default URL when SKILLMESH_CATALOG_URL is unset', () => {
    const config = getCatalogConfig({})
    expect(config.url).to.equal('https://raw.githubusercontent.com/DTim887/skill-mesh/main/registry/catalog.json')
  })

  it('uses SKILLMESH_CATALOG_URL when set', () => {
    const config = getCatalogConfig({SKILLMESH_CATALOG_URL: 'https://git.example.internal/catalog.json'})
    expect(config.url).to.equal('https://git.example.internal/catalog.json')
  })

  it('leaves token undefined when SKILLMESH_CATALOG_TOKEN is unset', () => {
    const config = getCatalogConfig({})
    expect(config.token).to.equal(undefined)
  })

  it('exposes SKILLMESH_CATALOG_TOKEN when set', () => {
    const config = getCatalogConfig({SKILLMESH_CATALOG_TOKEN: 'secret-token'})
    expect(config.token).to.equal('secret-token')
  })
})
