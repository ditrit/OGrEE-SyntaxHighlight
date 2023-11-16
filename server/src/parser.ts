
import {
	Diagnostic,
	DiagnosticSeverity
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

const commandSeparators = ["\n", "//"];
const commandList = ["+tenant:[+name]@[=color]"];

var variableNames: string[] = [];

export function getVariables() {
	return variableNames;
}

export function parseDocument(textDocument: TextDocument, settings: any): Diagnostic[] {
	variableNames = [];
	const text = textDocument.getText();
	const diagnostics: Diagnostic[] = [];
	let currentIndex = 0;
	let variableList = [];
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

function parseCommand(currentIndex: number, nextCommandIndex: number, nextCommand: string, text: string, diagnostics: Diagnostic[], textDocument: TextDocument): boolean {
	for (let command of commandList) {
		if (nextCommand.indexOf(command.substring(0,command.indexOf("["))) == 0) {
			const commandFound = true;
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

			return commandFound;
		}
	}
	return false;
}

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

function parseVariable(varType: any, currentIndex: number, nextCommandIndex: number, variable: string, textDocument: TextDocument): Diagnostic {
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

function readUntil(text: string, seq: string) {
	const index = text.indexOf(seq);
	if (index == -1) return text;
	const returnString = text.substring(0, index);
	return returnString;
}

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
