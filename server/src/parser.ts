
import {
	Diagnostic,
	DiagnosticSeverity
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

const commandSeparators = ["\n", "//"];
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
	let currentIndex = 0;
	let endSeparator = "\n";
	let startSeparator = "\n";
	let nextCommandIndex = 0;

	while (currentIndex < text.length) {
		startSeparator = endSeparator;
		nextCommandIndex = getNextPart(currentIndex, text, commandSeparators).index;
		endSeparator = getNextPart(currentIndex, text, commandSeparators).separator;
		let nextCommand = text.substring(currentIndex, nextCommandIndex);

		if (startSeparator == "\n") {
			const commandLength = nextCommand.length;
			nextCommand = nextCommand.trimStart();
			currentIndex += commandLength - nextCommand.length;
		}

		if (nextCommand != "") {
			if (startSeparator == "//") {
				diagnostics.push(parseComment(currentIndex, nextCommandIndex, textDocument));
			} else {
				const commandFound = parseCommand(currentIndex, nextCommandIndex, nextCommand, text, diagnostics, textDocument);
				if (!commandFound) {
					diagnostics.push(parseUnrecognizedCommand(currentIndex, nextCommandIndex, nextCommand, textDocument));
				}
			}
		}

		currentIndex = nextCommandIndex+endSeparator.length;
	}

	return diagnostics;
}

/**
 * Parses a comment and returns a diagnostic object.
 * @param currentIndex The index of the current character.
 * @param nextCommandIndex The index of the next command.
 * @param textDocument The text document to parse.
 * @returns A diagnostic object.
 */
function parseComment(currentIndex: number, nextCommandIndex: number, textDocument: TextDocument): Diagnostic {
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Information,
		range: {
			start: textDocument.positionAt(currentIndex-2),
			end: textDocument.positionAt(nextCommandIndex)
		},
		message: `this is a comment`,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Parses a command from a given text and returns whether a command was found or not.
 * @param currentIndex The current index in the text.
 * @param nextCommandIndex The index of the next command in the text.
 * @param nextCommand The next command to parse.
 * @param text The text to parse.
 * @param diagnostics An array of diagnostics to add any errors or warnings found during parsing.
 * @param textDocument The text document to parse.
 * @returns Whether a command was found or not.
 */
function parseCommand(currentIndex: number, nextCommandIndex: number, nextCommand: string, text: string, diagnostics: Diagnostic[], textDocument: TextDocument): boolean {
	console.log("command", text)
	console.log("nextCommand", nextCommand)
	for (let command of commandList) {
		if (nextCommand.indexOf(command.substring(0,command.indexOf("["))) == 0) {
			diagnostics.push(parseFoundCommand(currentIndex, nextCommandIndex, textDocument));
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
					const variableEndPosition = text.indexOf(variableEndDelimiter, currentIndex);
					const varType = command.substring(currentSubCommandIndex, currentSubCommandIndex+1)

					if (variableEndDelimiter == "") {
						diagnostics.push(parseVariable(varType, currentIndex, nextCommandIndex, text, textDocument));
						foundVariable = true;
						break;
					}

					diagnostics.push(parseVariable(varType, currentIndex, variableEndPosition, text, textDocument));
					currentIndex = variableEndPosition + (variableEndDelimiterIndex - nextSubCommandIndex)-1;
					currentSubCommandIndex = variableEndDelimiterIndex + getNextPart(nextSubCommandIndex + commandSubEndSeparator.length, command, ["["]).separator.length;
					continue;
				}
				if (commandSubEndSeparator == "[") {
					currentIndex += nextSubCommandIndex - currentSubCommandIndex;
				}                        
				currentSubCommandIndex = nextSubCommandIndex+commandSubEndSeparator.length;
			}

			if (!foundVariable) {
				diagnostics.push(parseNoVariableFound(currentIndex, nextCommandIndex, command, textDocument));
			}

			return true;
		}
	}
	return false;
}

/**
 * Parses a found command and returns a diagnostic object.
 * @param currentIndex The index of the current command.
 * @param nextCommandIndex The index of the next command.
 * @param textDocument The text document to parse.
 * @returns A diagnostic object.
 */
function parseFoundCommand(currentIndex: number, nextCommandIndex: number, textDocument: TextDocument): Diagnostic {
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Information,
		range: {
			start: textDocument.positionAt(currentIndex),
			end: textDocument.positionAt(nextCommandIndex)
		},
		message: "command found",
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Parses a variable based on its type and returns a Diagnostic object.
 * @param varType The type of the variable (+, =, or -).
 * @param currentIndex The index of the current position in the text document.
 * @param nextCommandIndex The index of the next command in the text document.
 * @param variable The name of the variable to be parsed.
 * @param textDocument The TextDocument object representing the text document being parsed.
 * @returns A Diagnostic object representing the result of the parsing operation.
 */
function parseVariable(varType: any, currentIndex: number, nextCommandIndex: number, variable: string, textDocument: TextDocument): Diagnostic {
	console.log("varType: " + varType);
	console.log("variable", variable)
	if (varType == "+") {
		variableNames.push(variable);
		return {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(currentIndex),
				end: textDocument.positionAt(nextCommandIndex)
			},
			message: "var stored",
			source: 'Ogree_parser'
		};
	}
	if (varType == "=") {
		for(var i = 0; i < variableNames.length; i++) {
			if (variableNames[i] == variable) {
				return {
					severity: DiagnosticSeverity.Warning,
					range: {
						start: textDocument.positionAt(currentIndex),
						end: textDocument.positionAt(nextCommandIndex)
					},
					message: "var exist",
					source: 'Ogree_parser'
				};
			}
		}
		return {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(currentIndex),
				end: textDocument.positionAt(nextCommandIndex)
			},
			message: variable + " is not defined",
			source: 'Ogree_parser'
		};
	}
	if (varType == "-") {
		for(var i = 0; i < variableNames.length; i++) {
			if (variableNames[i] == variable) {
				variableNames.splice(i, 1);
				return {
					severity: DiagnosticSeverity.Warning,
					range: {
						start: textDocument.positionAt(currentIndex),
						end: textDocument.positionAt(nextCommandIndex)
					},
					message: "var removed",
					source: 'Ogree_parser'
				};
			}
		}
		return {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(currentIndex),
				end: textDocument.positionAt(nextCommandIndex)
			},
			message: variable + " is not defined",
			source: 'Ogree_parser'
		};
	}
	return {
		severity: DiagnosticSeverity.Warning,
		range: {
			start: textDocument.positionAt(currentIndex),
			end: textDocument.positionAt(nextCommandIndex)
		},
		message: variable + "Parser error",
		source: 'Ogree_parser'
	};
}

/**
 * Parses an unrecognized command and returns a diagnostic object.
 * @param currentIndex The index of the current command.
 * @param nextCommandIndex The index of the next command.
 * @param nextCommand The next command to be parsed.
 * @param textDocument The text document being parsed.
 * @returns A diagnostic object representing the unrecognized command error.
 */
function parseUnrecognizedCommand(currentIndex: number, nextCommandIndex: number, nextCommand: string, textDocument: TextDocument): Diagnostic {
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(currentIndex),
			end: textDocument.positionAt(nextCommandIndex)
		},
		message: "unrocognized command: " + nextCommand,
		source: 'Ogree_parser'
	};
	return diagnostic;
}

/**
 * Parses a command and returns a diagnostic if no variable is found.
 * @param currentIndex The starting index of the command.
 * @param nextCommandIndex The ending index of the command.
 * @param command The command to parse.
 * @param textDocument The text document to parse the command from.
 * @returns A diagnostic object indicating that no variable was found in the command.
 */
function parseNoVariableFound(currentIndex: number, nextCommandIndex: number, command: string, textDocument: TextDocument): Diagnostic {
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: {
			start: textDocument.positionAt(currentIndex),
			end: textDocument.positionAt(nextCommandIndex)
		},
		message: "no variable found in command: " + command,
		source: 'Ogree_parser'
	};
	return diagnostic;
}


/**
 * Returns the index and separator of the next delimiter in the given text, starting from the given index.
 * @param currentIndex The index to start searching from.
 * @param text The text to search for delimiters in.
 * @param delimitersList The list of delimiters to search for.
 * @returns An object containing the index and separator of the next delimiter.
 */
function getNextPart(currentIndex: any, text: string, delimitersList: any) {
	let nextCommandIndexPotential = 0;
	let nextCommandIndex = text.length;
	let endSeparator = "";

	for (const delimiter of delimitersList) {
		nextCommandIndexPotential = text.indexOf(delimiter, currentIndex);
		if (nextCommandIndexPotential != -1 && nextCommandIndexPotential < nextCommandIndex) {
			nextCommandIndex = nextCommandIndexPotential;
			endSeparator = delimiter;
		}
	}

	return { index: nextCommandIndex, separator: endSeparator };
}
