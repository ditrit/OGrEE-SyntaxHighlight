/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	TextDocumentSyncKind,
	InitializeResult,
	Diagnostic
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { autoCompletion } from "./autoCompletion.js";
import { parseDocument } from "./parser.js"

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface Settings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: Settings = { maxNumberOfProblems: 1000 };
let globalSettings: Settings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<Settings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <Settings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<Settings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerExample'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

<<<<<<< HEAD
function read_until(text: string, seq: string) {
	const index = text.indexOf(seq);
	if (index == -1) return text;
	const return_string = text.substring(0, index);

	return return_string;

}

//return index of next delimiter
function get_next_part(current_index: any, text: string, delimiters_list: any) {

	let next_command_index_potential = 0;
	let next_command_index = text.length;
	let end_separator = "";
	
	for (const delimiter of delimiters_list) {
		next_command_index_potential = text.indexOf(delimiter, current_index);
		if (next_command_index_potential != -1 && next_command_index_potential < next_command_index) {
			next_command_index = next_command_index_potential;
			end_separator = delimiter;
		}

	}

	return {index: next_command_index, separator: end_separator};

}

var variable_names: string[] = []


//handle what to do with the variable that was encountered in the document
function handle_variable(var_type: any, variable: any): any {

	if (var_type == "+") {
		//store var in array
		variable_names.push(variable);
		return "var stored"
	}
	if (var_type == "=") {
		
		for(var i = 0; i < variable_names.length; i++) {
			if (variable_names[i] == variable) return "var exist"
		}

		return variable + " is not defined"
		

	}
	if (var_type == "-") {
		
		
		for(var i = 0; i < variable_names.length; i++) {
			if (variable_names[i] == variable) {
				variable_names.splice(i, 1);
				return "var removed"
			}variable_names
		}
		return variable + " is not defined"

	}

}


const command_separators = ["\n", "//"];
const commandList = ["+tenant:[+name]@[=color]"]

=======
>>>>>>> 5481ae77dbb70aedbbd20bcacd35535fd2ea33c9
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	const diagnostics = parseDocument(textDocument, await getDocumentSettings(textDocument.uri));
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// This handler provides the initial list of the completion items.
connection.onCompletion(autoCompletion(variable_names));

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
