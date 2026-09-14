import {Args, Command, Errors} from '@oclif/core'
import {existsSync} from 'node:fs'
import path from 'node:path'

import {confirmYesNo, isInteractiveTerminal} from '../lib/workspace/confirm.js'
import {createWorkspace} from '../lib/workspace/create.js'
import {isWorkspaceMarked, resolveTargetRoot, validateName} from '../lib/workspace/paths.js'

export default class Init extends Command {
  static override args = {
    name: Args.string({
      description: '在当前目录下创建的子目录名，作为工作区根；不提供时以当前目录本身作为工作区根',
      parse: async (input: string) => validateName(input),
      required: false,
    }),
  }
  static override description = `初始化一个 skillmesh 工作区（类似 git init）。

不带参数时以当前目录为工作区根；带参数时在当前目录下新建一个同名子目录作为工作区根。
执行前会展示即将写入的路径与文件清单，并等待交互式确认。`
  static override examples = [
    {
      command: '<%= config.bin %> <%= command.id %>',
      description: '以当前目录为工作区根初始化',
    },
    {
      command: '<%= config.bin %> <%= command.id %> myworkspace',
      description: '在当前目录下新建 myworkspace 子目录作为工作区根',
    },
  ]

  public async run(): Promise<void> {
    const {args} = await this.parse(Init)

    if (!isInteractiveTerminal()) {
      throw new Errors.CLIError('此命令需要交互式终端才能运行', {code: 'INIT_NOT_INTERACTIVE', exit: 6})
    }

    const root = resolveTargetRoot(process.cwd(), args.name)

    if (isWorkspaceMarked(root)) {
      throw new Errors.CLIError('该目录已经初始化过', {code: 'INIT_ALREADY_INITIALIZED', exit: 5})
    }

    if (args.name && existsSync(root)) {
      const proceedIntoExisting = await confirmYesNo(`目录已经存在：${root}\n是否要在这个已存在的目录中继续初始化？(y/N) `)
      if (!proceedIntoExisting) {
        this.log('已取消，未做任何改动')
        return
      }
    }

    const filesToCreate = ['.skillmesh/registry.json', '.claude/skills/skillmesh/SKILL.md']
    this.log(`即将在以下路径初始化 skillmesh 工作区：\n  ${root}\n\n将写入以下文件：\n${filesToCreate.map((f) => `  ${f}`).join('\n')}\n`)

    const proceed = await confirmYesNo('是否继续？(y/N) ')
    if (!proceed) {
      this.log('已取消，未做任何改动')
      return
    }

    const skillTemplatePath = path.join(this.config.root, 'resources/skills/skillmesh/SKILL.md')
    await createWorkspace(root, skillTemplatePath)
    this.log(`工作区初始化完成：${root}`)
  }
}
