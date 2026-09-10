// Points at the public skill-mesh dev repo's raw content endpoint for local/POC use.
// Override with SKILLMESH_CATALOG_URL once the real internal Git host is confirmed.
const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/DTim887/skill-mesh/main/registry/catalog.json'

export type CatalogConfig = {
  token?: string
  url: string
}

export function getCatalogConfig(env: NodeJS.ProcessEnv = process.env): CatalogConfig {
  const url = env.SKILLMESH_CATALOG_URL?.trim() || DEFAULT_CATALOG_URL
  const token = env.SKILLMESH_CATALOG_TOKEN?.trim() || undefined

  return {token, url}
}
