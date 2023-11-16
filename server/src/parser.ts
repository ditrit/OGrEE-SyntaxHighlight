import {
	Diagnostic,
	DiagnosticSeverity
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';



function readUntil(text: string, seq: string) {
	const index = text.indexOf(seq);
	if (index == -1) return text;
	const returnString = text.substring(0, index);

	return returnString;

}

//return index of next delimiter
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

export function getVariables(){
	return variableNames;
}

var variableNames: string[] = []


//handle what to do with the variable that was encountered in the document
function handleVariable(varType: any, variable: any): any {

	if (varType == "+") {
		//store var in array
		variableNames.push(variable);
		return "var stored"
	}
	if (varType == "=") {

		for(var i = 0; i < variableNames.length; i++) {
			if (variableNames[i] == variable) return "var exist"
		}

		return variable + " is not defined"


	}
	if (varType == "-") {


		for(var i = 0; i < variableNames.length; i++) {
			if (variableNames[i] == variable) {
				variableNames.splice(i, 1);
				return "var removed"
			}
		}
		return variable + " is not defined"

	}

}

const commandSeparators = ["\n", "//"];
const commandList = ["+tenant:[+name]@[=color]"]

export function parseDocument(textDocument: TextDocument, settings: any): Diagnostic[] {

	variableNames = []

	const text = textDocument.getText();
	
	const diagnostics: Diagnostic[] = [];
	let currentIndex = 0;

	currentIndex = 0;
	let variableList = [];
	
	let endSeparator = "\n";
	let startSeparator = "\n" //treat first line like a new line
	let nextCommandIndex = 0;
	
	//the parser is in this loop
	//the code is HORRIBLE for now, it should really be moved into it's own class (even multiple class probably) cuz variable names are getting terrible
	while (currentIndex < text.length) {

		//look for next instruction
		startSeparator = endSeparator; //searching for new cmd, so end separator is now start
		let nextCommandIndex = getNextPart(currentIndex, text, commandSeparators).index;
		endSeparator = getNextPart(currentIndex, text, commandSeparators).separator;

		//find next command, remove eventual starting whitespaces if newline
		let nextCommand = text.substring(currentIndex, nextCommandIndex);
		
		if (startSeparator == "\n") {
			const commandLength = nextCommand.length;
			nextCommand = nextCommand.trimStart();
			currentIndex += commandLength - nextCommand.length;
		}

		if (nextCommand != "") {

			//test the separator for comments
			if (startSeparator == "//") {

				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Information,
					range: {
						start: textDocument.positionAt(currentIndex-2),
						end: textDocument.positionAt(nextCommandIndex)
					},
					message: `this is a comment`,
					source: 'Ogree_parser'
				};
				
				diagnostics.push(diagnostic);

			} else {

				//test if command in command list
				let cmdFound = 0;
				for (let command of commandList) {
					
					

					if (nextCommand.indexOf(command.substring(0,command.indexOf("["))) == 0) {
						//command found!
						cmdFound = 1;

						const diagnostic: Diagnostic = {
							severity: DiagnosticSeverity.Information,
							range: {
								start: textDocument.positionAt(currentIndex),
								end: textDocument.positionAt(nextCommandIndex)
							},
							message: "command found",
							source: 'Ogree_parser'
						};
	
						diagnostics.push(diagnostic);
						
						let commandSubEndSeparator = "]";
						let commandSubStartSeparator = "]";
						
						let currentSubCommandIndex = 0;

						let foundVariable = false;

						//next line has been delimited, exclusing comments, so now trying to match what's left against the command list, which really should be loaded from json but i'll add it later
						while (currentSubCommandIndex < command.length && !foundVariable) {

							commandSubStartSeparator = commandSubEndSeparator; //searching for new cmd, so end separator is now start
							//give the end of the next command, starting at commandSubIndex and ending at nextCommandSubIndex
							let nextSubCommandIndex = getNextPart(currentSubCommandIndex, command, ["[", "]"]).index;
							commandSubEndSeparator = getNextPart(currentSubCommandIndex, command, ["[", "]"]).separator;

							//handle what part of the command we are looking at rn
							//if end separator is ], get variable name(until next separator ?)
							if (commandSubEndSeparator == "]") {
								//means we're chekcing a variable, so get the end of command delimiter
								const variableEndDelimiterIndex = getNextPart(nextSubCommandIndex + commandSubEndSeparator.length, command, ["["]).index;
								const variableEndDelimiter = command.substring(nextSubCommandIndex+commandSubEndSeparator.length, variableEndDelimiterIndex);
								//check in document
								const variableEndPosition = text.indexOf(variableEndDelimiter, currentIndex);


								//also need to check if we're adding, consomming or just using a variable, so checking for "+/=/- at the start of var name"
								const varType = command.substring(currentSubCommandIndex, currentSubCommandIndex+1)


								if (variableEndDelimiter == "") {
									//means variable is at the end of command
									//ignore variableEndPosition, it's gonna be garbage anyway

									const diagnostic: Diagnostic = {
										severity: DiagnosticSeverity.Warning,
										range: {
											start: textDocument.positionAt(currentIndex),
											end: textDocument.positionAt(nextCommandIndex)
										},
										message: handleVariable(varType, text.substring(currentIndex, nextCommandIndex)),
										source: 'Ogree_parser'
									};

									
				
									diagnostics.push(diagnostic);
									foundVariable = true;
									break;

								}
								
								const diagnostic: Diagnostic = {
									severity: DiagnosticSeverity.Warning,
									range: {
										start: textDocument.positionAt(currentIndex),
										end: textDocument.positionAt(variableEndPosition)
									},
									message: handleVariable(varType, text.substring(currentIndex, variableEndPosition)),
									source: 'Ogree_parser'
								};
			
								diagnostics.push(diagnostic);

								//update document index
								currentIndex = variableEndPosition + (variableEndDelimiterIndex - nextSubCommandIndex)-1;
								//update comand index
								currentSubCommandIndex = variableEndDelimiterIndex + getNextPart(nextSubCommandIndex + commandSubEndSeparator.length, command, ["["]).separator.length;
								continue;
							}
							if (commandSubEndSeparator == "[") {
								currentIndex += nextSubCommandIndex - currentSubCommandIndex;
							}						

							currentSubCommandIndex = nextSubCommandIndex+commandSubEndSeparator.length; //ignore separator in the main loop, will be treated in cmd loop
						}

						if (!foundVariable) {
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: {
									start: textDocument.positionAt(currentIndex),
									end: textDocument.positionAt(nextCommandIndex)
								},
								message: "no variable found in command: " + command,
								source: 'Ogree_parser'
							};

							diagnostics.push(diagnostic);
						}

						break;
					}

				} 

				if (cmdFound == 0) {
					//means every command was checked but none matched with this
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Error,
						range: {
							start: textDocument.positionAt(currentIndex),
							end: textDocument.positionAt(nextCommandIndex)
						},
						message: "unrocognized command: " + nextCommand,
						source: 'Ogree_parser'
					};

					diagnostics.push(diagnostic);
				}
			}
		}

		currentIndex = nextCommandIndex+endSeparator.length; //ignore separator in the main loop, will be treated in cmd loop
	}
	return diagnostics;
	// Send the computed diagnostics to VSCode.
	//connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}


module.exports = { parseDocument }