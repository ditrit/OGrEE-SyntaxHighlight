/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

//import {autoCompletion} from "./autoCompletion.js";
import {autoCompletion} from "./autoCompletion.js";

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
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
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
			}
		}
		return variable + " is not defined"

	}

}


const command_separators = ["\n", "//"];
const commandList = ["+tenant:[+name]@[=color]"]

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	variable_names = []

	const text = textDocument.getText();
	
	const diagnostics: Diagnostic[] = [];
	let current_index = 0;

	current_index = 0;
	let variable_list = [];
	
	let end_separator = "\n";
	let start_separator = "\n" //treat first line like a new line
	let next_command_index = 0;
	
	//the parser is in this loop
	//the code is HORRIBLE for now, it should really be moved into it's own class (even multiple class probably) cuz variable names are getting terrible
	while (true) {

		//look for next instruction
		start_separator = end_separator; //searching for new cmd, so end separator is now start
		let next_command_index = get_next_part(current_index, text, command_separators).index;
		end_separator = get_next_part(current_index, text, command_separators).separator;

		//find next command, remove eventual starting whitespaces if newline
		let next_command = text.substring(current_index, next_command_index);
		
		if (start_separator == "\n") {
			const command_length = next_command.length;
			next_command = next_command.trimStart();
			current_index += command_length - next_command.length;
		}

		if (next_command != "") {

			//test the separator for comments
			if (start_separator == "//") {

				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Information,
					range: {
						start: textDocument.positionAt(current_index-2),
						end: textDocument.positionAt(next_command_index)
					},
					message: `this is a comment`,
					source: 'Ogree_parser'
				};
				
				diagnostics.push(diagnostic);

			} else {

				//test if command in command list
				let cmd_found = 0;
				for (let command of commandList) {
					
					

					if (next_command.indexOf(command.substring(0,command.indexOf("["))) == 0) {
						//command found!
						cmd_found = 1;

						const diagnostic: Diagnostic = {
							severity: DiagnosticSeverity.Information,
							range: {
								start: textDocument.positionAt(current_index),
								end: textDocument.positionAt(next_command_index)
							},
							message: "command found",
							source: 'Ogree_parser'
						};
	
						diagnostics.push(diagnostic);
						
						let command_sub_end_separator = "]";
						let command_sub_start_separator = "]";
						
						let current_sub_command_index = 0;


						//next line has been delimited, exclusing comments, so now trying to match what's left against the command list, which really should be loaded from json but i'll add it later
						while (1) {

							command_sub_start_separator = command_sub_end_separator; //searching for new cmd, so end separator is now start
							//give the end of the next command, starting at command_sub_index and ending at next_command_sub_index
							let next_sub_command_index = get_next_part(current_sub_command_index, command, ["[", "]"]).index;
							command_sub_end_separator = get_next_part(current_sub_command_index, command, ["[", "]"]).separator;

							//handle what part of the command we are looking at rn
							//if end separator is ], get variable name(until next separator ?)
							if (command_sub_end_separator == "]") {
								//means we're chekcing a variable, so get the end of command delimiter
								const variable_end_delimiter_index = get_next_part(next_sub_command_index + command_sub_end_separator.length, command, ["["]).index;
								const variable_end_delimiter = command.substring(next_sub_command_index+command_sub_end_separator.length, variable_end_delimiter_index);
								//check in document
								const variable_end_position = text.indexOf(variable_end_delimiter, current_index);


								//also need to check if we're adding, consomming or just using a variable, so checking for "+/=/- at the start of var name"
								const var_type = command.substring(current_sub_command_index, current_sub_command_index+1)


								if (variable_end_delimiter == "") {
									//means variable is at the end of command
									//ignore variable_end_position, it's gonna be garbage anyway

									const diagnostic: Diagnostic = {
										severity: DiagnosticSeverity.Warning,
										range: {
											start: textDocument.positionAt(current_index),
											end: textDocument.positionAt(next_command_index)
										},
										message: handle_variable(var_type, text.substring(current_index, next_command_index)),
										source: 'Ogree_parser'
									};

									
				
									diagnostics.push(diagnostic);
									break;

								}
								
								const diagnostic: Diagnostic = {
									severity: DiagnosticSeverity.Warning,
									range: {
										start: textDocument.positionAt(current_index),
										end: textDocument.positionAt(variable_end_position)
									},
									message: handle_variable(var_type, text.substring(current_index, variable_end_position)),
									source: 'Ogree_parser'
								};
			
								diagnostics.push(diagnostic);

								//update document index
								current_index = variable_end_position + (variable_end_delimiter_index - next_sub_command_index)-1;
								//update comand index
								current_sub_command_index = variable_end_delimiter_index + get_next_part(next_sub_command_index + command_sub_end_separator.length, command, ["["]).separator.length;
								continue;
							}
							if (command_sub_end_separator == "[") {
								current_index += next_sub_command_index - current_sub_command_index;
							}						

							current_sub_command_index = next_sub_command_index+command_sub_end_separator.length; //ignore separator in the main loop, will be treated in cmd loop
							if (current_sub_command_index >= command.length) break;
						}

						break;
					}

				} 

				if (cmd_found == 0) {
					//means every command was checked but none matched with this
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Error,
						range: {
							start: textDocument.positionAt(current_index),
							end: textDocument.positionAt(next_command_index)
						},
						message: "unrocognized command: " + next_command,
						source: 'Ogree_parser'
					};

					diagnostics.push(diagnostic);
				}
			}
		}

		current_index = next_command_index+end_separator.length; //ignore separator in the main loop, will be treated in cmd loop
		if (current_index >= text.length) break; //if EOF stop

	}



	
	/*const pattern = /\b[A-Z]{2,}\b/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		problems++;
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} is all uppercase.`,
			source: 'ex'
		};
		if (hasDiagnosticRelatedInformationCapability) {
			diagnostic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Spelling matters'
				},
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Particularly for names'
				}
			];
		}
		diagnostics.push(diagnostic);
	}*/

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(autoCompletion());

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
