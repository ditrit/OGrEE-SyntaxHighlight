
import {
	Diagnostic,
	DiagnosticSeverity,
	Position
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

// TOO : add config file
const commandList = ["+tenant:[+name]@[=color]"];

var variableNames: string[] = [];

export function getVariables() {
	return variableNames;
}

/**
 * Parses a text document and returns an array of diagnostics.
 * 
 * @param textDocument The text document to parse.
 * @param settings The settings to use for parsing.
 * @returns An array of diagnostics.
 */
export function parseDocument(textDocument: TextDocument, settings: any): Diagnostic[] {
	variableNames = [];
	const text = textDocument.getText();
	const diagnostics: Diagnostic[] = [];
	const lines = text.split("\n");

	for (let [index, line] of lines.entries()){
		let startPosition = Position.create(index, 0);
		let endCommandIndex = Position.create(index, line.length);
		let command = line.trim()
		if (command != "") {
			if (command.startsWith("//")) {
				diagnostics.push(parseComment(startPosition, endCommandIndex, textDocument));
			} else {
				const commandFound = parseCommand(startPosition, endCommandIndex, command, text, diagnostics, textDocument);
				if (!commandFound) {
					diagnostics.push(parseUnrecognizedCommand(startPosition, endCommandIndex, command, textDocument));
				}
			}
		}
	}
	return diagnostics;
}

/**
 * Parses a comment and returns a diagnostic object.
 * @param startPosition The index of the current character.
 * @param endPosition The index of the next command.
 * @param textDocument The text document to parse.
 * @returns A diagnostic object.
 */
function parseComment(startPosition: Position, endPosition: Position, textDocument: TextDocument): Diagnostic {
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Information,
		range: {
			start: startPosition,
			end: endPosition
		},
		message: `this is a comment`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Parses a command from a given text and returns whether a command was found or not.
 * @param startPosition The current index in the text.
 * @param endPosition The index of the next command in the text.
 * @param nextCommand The next command to parse.
 * @param text The text to parse.
 * @param diagnostics An array of diagnostics to add any errors or warnings found during parsing.
 * @param textDocument The text document to parse.
 * @returns Whether a command was found or not.
 */
function parseCommand(startPosition: Position, endPosition: Position, command: string, text: string, diagnostics: Diagnostic[], textDocument: TextDocument): boolean {
	const commandData = /(?<action>\+|-)(?<type>\w+):(?<name>\w+)@(?<params>.+)/.exec(command)?.groups;
	if (commandData) {
		const groupsLocation;
		commandData.forEach((group : string) => command.indexOf(commandData.group));
		variableStartPosition = textDocument.offsetAt(startPosition) + groupsLocation[0];
		diagnostics.push(parseVariable(commandData.action, commandData.type, commandData.name, startPosition, endPosition));

	}
	

	console.log("regex", commandData)
		for (let command of commandList) {
		if (command.indexOf(command.substring(0,command.indexOf("["))) == 0) {
			diagnostics.push(parseFoundCommand(startPosition, endPosition, textDocument));
			let commandSubEndSeparator = "]";
			let commandSubStartSeparator = "]";
			let currentSubCommandIndex = 0;
			let foundVariable = false;

			while (currentSubCommandIndex < command.length && !foundVariable) {
				commandSubStartSeparator = commandSubEndSeparator;
				let nextSubCommandIndex = getNextPart(currentSubCommandIndex, command, ["[", "]"]).index;
				commandSubEndSeparator = getNextPart(currentSubCommandIndex, command, ["[", "]"]).separator;

				if (commandSubEndSeparator == "]") {
					const variableEndDelimiterIndex = getNextPart(nextSubCommandIndex + commandSubEndSeparator.length, command, ["["]).index;
					const variableEndDelimiter = command.substring(nextSubCommandIndex+commandSubEndSeparator.length, variableEndDelimiterIndex);
					const variableEndPosition = text.indexOf(variableEndDelimiter, textDocument.offsetAt(startPosition));
					const action = command.substring(currentSubCommandIndex, currentSubCommandIndex+1)

					if (variableEndDelimiter == "") {
						diagnostics.push(parseVariable(action, startPosition, endPosition, text, textDocument));
						foundVariable = true;
						break;
					}

					diagnostics.push(parseVariable(action, startPosition, textDocument.positionAt(variableEndPosition), text, textDocument));
					let startPosition2 = variableEndPosition + (variableEndDelimiterIndex - nextSubCommandIndex)-1;
					currentSubCommandIndex = variableEndDelimiterIndex + getNextPart(nextSubCommandIndex + commandSubEndSeparator.length, command, ["["]).separator.length;
					continue;
				}
				if (commandSubEndSeparator == "[") {
					//startPosition += nextSubCommandIndex - currentSubCommandIndex;
				}                        
				currentSubCommandIndex = nextSubCommandIndex+commandSubEndSeparator.length;
			}

			if (!foundVariable) {
				diagnostics.push(parseNoVariableFound(startPosition, endPosition, command, textDocument));
			}

			return true;
		}
	}
	return false;
}

/**
 * Parses a found command and returns a diagnostic object.
 * @param startPosition The index of the current command.
 * @param endPosition The index of the next command.
 * @param textDocument The text document to parse.
 * @returns A diagnostic object.
 */
function parseFoundCommand(startPosition: Position, endPosition: Position, textDocument: TextDocument): Diagnostic {
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Information,
		range: {
			start: startPosition,
			end: endPosition
		},
		message: "command found",
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Parses a variable based on its type and returns a Diagnostic object.
 * @param action The type of the variable (+, =, or -).
 * @param startPosition The index of the current position in the text document.
 * @param endPosition The index of the next command in the text document.
 * @param variable The name of the variable to be parsed.
 * @param textDocument The TextDocument object representing the text document being parsed.
 * @returns A Diagnostic object representing the result of the parsing operation.
 */
function parseVariable(action: any, type : string, name: string, startPosition: Position, endPosition: Position): Diagnostic {
	if (action == "+") {
		variableNames.push(name);
		return {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: startPosition,
				end: endPosition
			},
			message: "var stored",
			source: 'Ogree_parser'
		};
	}
	if (action == "=") {
		for(var i = 0; i < variableNames.length; i++) {
			if (variableNames[i] == name) {
				return {
					severity: DiagnosticSeverity.Warning,
					range: {
						start: startPosition,
						end: endPosition
					},
					message: "var exist",
					source: 'Ogree_parser'
				};
			}
		}
		return {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: startPosition,
				end: endPosition
			},
			message: name + " is not defined",
			source: 'Ogree_parser'
		};
	}
	if (action == "-") {
		for(var i = 0; i < variableNames.length; i++) {
			if (variableNames[i] == name) {
				variableNames.splice(i, 1);
				return {
					severity: DiagnosticSeverity.Warning,
					range: {
						start: startPosition,
						end: endPosition
					},
					message: "var removed",
					source: 'Ogree_parser'
				};
			}
		}
		return {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: startPosition,
				end: endPosition
			},
			message: name + " is not defined",
			source: 'Ogree_parser'
		};
	}
	return {
		severity: DiagnosticSeverity.Error,
		range: {
			start: startPosition,
			end: endPosition
		},
		message: name + "Parser error",
		source: 'Ogree_parser'
	};
}

/**
 * Parses an unrecognized command and returns a diagnostic object.
 * @param startPosition The index of the current command.
 * @param endPosition The index of the next command.
 * @param nextCommand The next command to be parsed.
 * @param textDocument The text document being parsed.
 * @returns A diagnostic object representing the unrecognized command error.
 */
function parseUnrecognizedCommand(startPosition: Position, endPosition: Position, nextCommand: string, textDocument: TextDocument): Diagnostic {
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: startPosition,
			end: endPosition
		},
		message: "unrocognized command: " + nextCommand,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Parses a command and returns a diagnostic if no variable is found.
 * @param startPosition The starting index of the command.
 * @param endPosition The ending index of the command.
 * @param command The command to parse.
 * @param textDocument The text document to parse the command from.
 * @returns A diagnostic object indicating that no variable was found in the command.
 */
function parseNoVariableFound(startPosition: Position, endPosition: Position, command: string, textDocument: TextDocument): Diagnostic {
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: startPosition,
			end: endPosition
		},
		message: "no variable found in command: " + command,
		source: 'Ogree_parser'
	};
	return diagnostic;
}


/**
 * Returns the index and separator of the next delimiter in the given text, starting from the given index.
 * @param startPosition The index to start searching from.
 * @param text The text to search for delimiters in.
 * @param delimitersList The list of delimiters to search for.
 * @returns An object containing the index and separator of the next delimiter.
 */
function getNextPart(startPosition: any, text: string, delimitersList: any) {
	let endPositionPotential = 0;
	let endPosition = text.length;
	let endSeparator = "";

	for (const delimiter of delimitersList) {
		endPositionPotential = text.indexOf(delimiter, startPosition);
		if (endPositionPotential != -1 && endPositionPotential < endPosition) {
			endPosition = endPositionPotential;
			endSeparator = delimiter;
		}
	}

	return { index: endPosition, separator: endSeparator };
}
