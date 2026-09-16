import {Args, Command, Errors, Flags} from '@oclif/core'

import {fetchCatalog, findDomainById} from '../../lib/domain/catalog.js'
import {fetchManifest, validateManifest} from '../../lib/domain/manifest.js'
import {appendInstalledRecord, isDomainInstalled, readRegistry} from '../../lib/domain/registry.js'
import {renderSkillMarkdown} from '../../lib/domain/render.js'
import {SKILL_TARGETS} from '../../lib/skill-targets.js'
import {confirmYesNo, isInteractiveTerminal} from '../../lib/workspace/confirm.js'
import {findWorkspaceRoot} from '../../lib/workspace/paths.js'

export default class DomainAdd extends Command {
  static override args = {
    id: Args.string({
      description: '要安装的 Domain id，对应中心知识库目录里登记的 id',
      required: true,
    }),
  }
  static override description = `将一个 Domain 知识库安装进当前工作区。

按 id 从中心知识库目录查到来源仓库与默认版本，拉取该仓库对应版本的 manifest 后，
合成一份技能文档写入工作区，并在安装记录中留痕。已经安装过的 id 会被拒绝，不做覆盖，
如需切换版本请联系维护者了解后续的更新能力。`
  static override examples = [
    {
      command: '<%= config.bin %> <%= command.id %> ordering',
      description: '安装 ordering 这个 Domain 的默认版本',
    },
    {
      command: '<%= config.bin %> <%= command.id %> ordering --tag 0.9.0',
      description: '显式安装 ordering 的 0.9.0 版本，而不是默认版本',
    },
  ]
  static override flags = {
    tag: Flags.string({
      description: '显式指定要安装的版本（不传则使用中心知识库目录记录的默认版本）',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(DomainAdd)

    if (!isInteractiveTerminal()) {
      throw new Errors.CLIError('此命令需要交互式终端才能运行', {code: 'DOMAIN_ADD_NOT_INTERACTIVE', exit: 6})
    }

    const root = findWorkspaceRoot(process.cwd())
    if (!root) {
      throw new Errors.CLIError('当前目录不在 skillmesh 工作区内，请先执行 `skillmesh init`', {
        code: 'DOMAIN_ADD_NOT_A_WORKSPACE',
        exit: 7,
      })
    }

    const domains = await fetchCatalog()
    const domain = findDomainById(domains, args.id)
    if (!domain) {
      throw new Errors.CLIError(`未找到该 Domain：${args.id}`, {code: 'DOMAIN_ADD_NOT_FOUND', exit: 8})
    }

    const targetVersion = flags.tag ?? domain.version

    const manifest = await fetchManifest(domain.repository, targetVersion)
    validateManifest(manifest, args.id, targetVersion)

    const registry = await readRegistry(root)
    if (isDomainInstalled(registry, args.id)) {
      throw new Errors.CLIError(`已经安装过 ${args.id}`, {code: 'DOMAIN_ADD_ALREADY_INSTALLED', exit: 10})
    }

    const skillDirName = `${args.id}-knowledge`
    const relativeSkillPaths = SKILL_TARGETS.map((target) => `${target.skillsDir}/${skillDirName}/SKILL.md`)

    this.log(
      `即将安装：${manifest.name}\n版本：${targetVersion}\n将写入：\n${relativeSkillPaths.map((p) => `  ${p}`).join('\n')}\n`,
    )

    const proceed = await confirmYesNo('是否继续？(y/N) ')
    if (!proceed) {
      this.log('已取消，未做任何改动')
      return
    }

    const skillMarkdown = renderSkillMarkdown(manifest)
    await appendInstalledRecord(
      root,
      {
        files: relativeSkillPaths,
        id: args.id,
        'installed_at': new Date().toISOString(),
        repository: domain.repository,
        type: 'domain',
        version: targetVersion,
      },
      SKILL_TARGETS,
      {content: skillMarkdown, dirName: skillDirName},
    )

    this.log(`安装完成：\n${relativeSkillPaths.map((p) => `  ${p}`).join('\n')}`)
  }
}
