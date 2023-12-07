/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import * as vscode from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

const tokensConfig = require("../../server/data/semantic_tokens.json");
const legend = new vscode.SemanticTokensLegend(tokensConfig.tokenTypes, tokensConfig.tokenModifiers);

const provider: vscode.DocumentSemanticTokensProvider = {
  provideDocumentSemanticTokens(
    document: vscode.TextDocument
  ): any {
    // analyze the document and return semantic tokens
	//console.log("DOC", document.getText(), typeof vscode.window.activeTextEditor.document)
	const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
	return client.sendRequest("custom/semanticTokens", [document, document.getText()]).then(data => {
		(<Array<any>> data).forEach((token) => {
			tokensBuilder.push(token.line, token.char, token.length, token.tokenType, token.tokenModifiers);
		});
		console.log("DATA", data);
	}).then(() => {
		return tokensBuilder.build();
	});
    
  }
};

const selector = { language: 'ogreecli', scheme: 'file' };


export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options:{execArgv: ['--nolazy', '--inspect=6009']}
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for OGrEE CLI documents
		documentSelector: [{ scheme: 'file', language: 'ogreecli' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerOCLI',
		'OGrEE CLI Language Server',
		serverOptions,
		clientOptions
	);

	vscode.languages.registerDocumentSemanticTokensProvider(selector, provider, legend)

	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}