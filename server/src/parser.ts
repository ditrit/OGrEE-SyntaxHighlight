import {
	Diagnostic,
	DiagnosticSeverity
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';


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

	return { index: next_command_index, separator: end_separator };

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

		for (var i = 0; i < variable_names.length; i++) {
			if (variable_names[i] == variable) return "var exist"
		}

		return variable + " is not defined"
	}
	if (var_type == "-") {
		for (var i = 0; i < variable_names.length; i++) {
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

export function parseDocument(textDocument: TextDocument, settings: any): Diagnostic[] {

	const text = textDocument.getText();
	
	const diagnostics: Diagnostic[] = [];
	let current_index = 0;

	current_index = 0;
	let variable_list = [];
	
	let end_separator = "\n";
	let start_separator = "\n" //treat first line like a new line
	let next_command_index = 0;

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
						//command = command.substring(0,command.indexOf("[")) // start checking for the first var, if it exist
						
						let command_sub_end_separator = "]";
						let command_sub_start_separator = "]";
						
						let current_sub_command_index = 0;

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

								if (variable_end_delimiter == "") {
									//means variable is at the end of command
									//ignore variable_end_position, it's gonna be garbage anyway

									const diagnostic: Diagnostic = {
										severity: DiagnosticSeverity.Warning,
										range: {
											start: textDocument.positionAt(current_index),
											end: textDocument.positionAt(next_command_index)
										},
										message: "last var",
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
									message: "var",
									source: 'Ogree_parser'
								};
			
								diagnostics.push(diagnostic);

								//update document index
								current_index = variable_end_position + (variable_end_delimiter_index - next_sub_command_index);
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

	return diagnostics;
	// Send the computed diagnostics to VSCode.
	//connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

module.exports = { parseDocument }