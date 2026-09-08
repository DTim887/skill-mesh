skillmesh
=================

A new CLI for SHDR generated with oclif


[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/skillmesh.svg)](https://npmjs.org/package/skillmesh)
[![Downloads/week](https://img.shields.io/npm/dw/skillmesh.svg)](https://npmjs.org/package/skillmesh)


<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g skillmesh
$ skillmesh COMMAND
running command...
$ skillmesh (--version)
skillmesh/0.0.0 darwin-arm64 node-v24.20.0
$ skillmesh --help [COMMAND]
USAGE
  $ skillmesh COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`skillmesh hello PERSON`](#skillmesh-hello-person)
* [`skillmesh hello world`](#skillmesh-hello-world)
* [`skillmesh help [COMMAND]`](#skillmesh-help-command)
* [`skillmesh plugins`](#skillmesh-plugins)
* [`skillmesh plugins add PLUGIN`](#skillmesh-plugins-add-plugin)
* [`skillmesh plugins:inspect PLUGIN...`](#skillmesh-pluginsinspect-plugin)
* [`skillmesh plugins install PLUGIN`](#skillmesh-plugins-install-plugin)
* [`skillmesh plugins link PATH`](#skillmesh-plugins-link-path)
* [`skillmesh plugins remove [PLUGIN]`](#skillmesh-plugins-remove-plugin)
* [`skillmesh plugins reset`](#skillmesh-plugins-reset)
* [`skillmesh plugins uninstall [PLUGIN]`](#skillmesh-plugins-uninstall-plugin)
* [`skillmesh plugins unlink [PLUGIN]`](#skillmesh-plugins-unlink-plugin)
* [`skillmesh plugins update`](#skillmesh-plugins-update)

## `skillmesh hello PERSON`

Say hello

```
USAGE
  $ skillmesh hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ skillmesh hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/DTim887/skill-mesh/blob/v0.0.0/src/commands/hello/index.ts)_

## `skillmesh hello world`

Say hello world

```
USAGE
  $ skillmesh hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ skillmesh hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/DTim887/skill-mesh/blob/v0.0.0/src/commands/hello/world.ts)_

## `skillmesh help [COMMAND]`

Display help for skillmesh.

```
USAGE
  $ skillmesh help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for skillmesh.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/6.3.0/src/commands/help.ts)_

## `skillmesh plugins`

List installed plugins.

```
USAGE
  $ skillmesh plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ skillmesh plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.5.2/src/commands/plugins/index.ts)_

## `skillmesh plugins add PLUGIN`

Installs a plugin into skillmesh.

```
USAGE
  $ skillmesh plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into skillmesh.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the SKILLMESH_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the SKILLMESH_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ skillmesh plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ skillmesh plugins add myplugin

  Install a plugin from a github url.

    $ skillmesh plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ skillmesh plugins add someuser/someplugin
```

## `skillmesh plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ skillmesh plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ skillmesh plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.5.2/src/commands/plugins/inspect.ts)_

## `skillmesh plugins install PLUGIN`

Installs a plugin into skillmesh.

```
USAGE
  $ skillmesh plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into skillmesh.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the SKILLMESH_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the SKILLMESH_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ skillmesh plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ skillmesh plugins install myplugin

  Install a plugin from a github url.

    $ skillmesh plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ skillmesh plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.5.2/src/commands/plugins/install.ts)_

## `skillmesh plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ skillmesh plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ skillmesh plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.5.2/src/commands/plugins/link.ts)_

## `skillmesh plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ skillmesh plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ skillmesh plugins unlink
  $ skillmesh plugins remove

EXAMPLES
  $ skillmesh plugins remove myplugin
```

## `skillmesh plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ skillmesh plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.5.2/src/commands/plugins/reset.ts)_

## `skillmesh plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ skillmesh plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ skillmesh plugins unlink
  $ skillmesh plugins remove

EXAMPLES
  $ skillmesh plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.5.2/src/commands/plugins/uninstall.ts)_

## `skillmesh plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ skillmesh plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ skillmesh plugins unlink
  $ skillmesh plugins remove

EXAMPLES
  $ skillmesh plugins unlink myplugin
```

## `skillmesh plugins update`

Update installed plugins.

```
USAGE
  $ skillmesh plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.5.2/src/commands/plugins/update.ts)_
<!-- commandsstop -->
