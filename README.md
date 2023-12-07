# OGrEE-CLI Linter module for IDEs

The goal of this project is to develop for IDEs a module to add linting to the OGrEE-CLI language. This module cas mainly developed in Typescript and javascript, and will implements the [LSP](https://microsoft.github.io/language-server-protocol/) protocol to ensure maximum compatibility with numerous IDEs.

## Installation

To install the module, simply head to the marketplace of supported IDEs and search for "OGrEE-CLI Linter".

Supported IDEs :
- (WIP) Visual Studio Code
- (Currently abandonned) Webstorm

## Supported IDEs

### Visual Studio Code

The Visual Studio Code extension is currently in development, and is not yet available on the marketplace. To install it, you will need to clone this repository and build the extension yourself. To do so, you will need to have [Node.js](https://nodejs.org/en/) installed on your computer.

#### How to publish or test

You need to have nodejs installed on your computer. Then, you can run the following commands to build the extension :

```bash
$ npm install -g @vscode/vsce
```

```bash
$ vsce package
```

It will generate a .vsix file that you can install in Visual Studio Code by going to the extensions tab, and clicking on the "Install from VSIX" button.
If you are satisfied, you can publish the extension on the marketplace by running the following command :

```bash
$ vsce publish
```

### Webstorm

The Webstorm plugin is currently abandonned, as the LSP support of Webstorm is not good enough to support the OGrEE-CLI language. You can still find the code in the webstorm folder of this repository.
