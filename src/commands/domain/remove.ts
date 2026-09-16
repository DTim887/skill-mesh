import {Args, Command, Errors} from '@oclif/core'

import {findInstalledRecord, readRegistry, removeInstalledRecord} from '../../lib/domain/registry.js'
import {confirmYesNo, isInteractiveTerminal} from '../../lib/workspace/confirm.js'
import {findWorkspaceRoot} from '../../lib/workspace/paths.js'

export default class DomainRemove extends Command {
  static override args = {
    id: Args.string({
      description: '要卸载的 Domain id，对应工作区安装记录里已存在的 id',
      required: true,
    }),
  }
  static override description = `从当前工作区卸载一个已安装的 Domain 知识库。

按工作区安装记录找到该 id 关联的文件，确认后逐一删除、清理变空的目录，并从安装记录中移除。
全程不需要网络访问。已缺失的文件会被容忍跳过，不会因此导致整个命令失败。`
  static override examples = [
    {
      command: '<%= config.bin %> <%= command.id %> ordering',
      description: '卸载已安装的 ordering 这个 Domain',
    },
  ]

  public async run(): Promise<void> {
    const {args} = await this.parse(DomainRemove)

    if (!isInteractiveTerminal()) {
      throw new Errors.CLIError('此命令需要交互式终端才能运行', {code: 'DOMAIN_REMOVE_NOT_INTERACTIVE', exit: 6})
    }

    const root = findWorkspaceRoot(process.cwd())
    if (!root) {
      throw new Errors.CLIError('当前目录不在 skillmesh 工作区内，请先执行 `skillmesh init`', {
        code: 'DOMAIN_REMOVE_NOT_A_WORKSPACE',
        exit: 7,
      })
    }

    const registry = await readRegistry(root)
    const record = findInstalledRecord(registry, args.id)
    if (!record) {
      throw new Errors.CLIError(
        `未安装：${args.id}，可以用 \`skillmesh domain search\` 确认装过哪些 domain`,
        {code: 'DOMAIN_REMOVE_NOT_INSTALLED', exit: 11},
      )
    }

    this.log(`即将删除 ${args.id}：\n${record.files.map((f) => `  ${f}`).join('\n')}\n`)

    const proceed = await confirmYesNo('是否继续？(y/N) ')
    if (!proceed) {
      this.log('已取消，未做任何改动')
      return
    }

    const deletedFiles = await removeInstalledRecord(root, args.id)

    this.log(`已移除 ${args.id}：\n${deletedFiles.map((f) => `  ${f}`).join('\n')}`)
  }
}
