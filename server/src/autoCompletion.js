import {
	CompletionItemKind,InsertTextFormat
} from 'vscode-languageserver/node';

import { getExistingVariables } from "./parser.js"

const commandList = require("./../data/command_list.json");
//need to parse commmand list for easier use during document parsing

export function autoCompletion(){
	return (_textDocumentPosition) => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		var listCommands = [];
		var listVariables = getExistingVariables(_textDocumentPosition.position.character);
		console.log("Position document:", _textDocumentPosition.textDocument.indexAt())
		console.log("Liste de variables :", listVariables)
		listVariables[0].forEach((variable) => {
				listCommands.push({
				label: variable,
				labelDetails: {
					description: "Variable"
				},
				kind: CompletionItemKind.Variable,
				sortText : variable,
				filterText : variable,
				detail : variable,
				documentation : variable, //{ kind : "markdown" ,value : elem.documentation},
				insertTextFormat : InsertTextFormat.PlainText,
				insertText : variable,
			})
		})

		listVariables[1].forEach((variable) => {
			listCommands.push({
			label: variable,
			labelDetails: {
				description: "Structure"
			},
			kind: CompletionItemKind.Variable,
			sortText : variable,
			filterText : variable,
			detail : variable,
			documentation : variable, //{ kind : "markdown" ,value : elem.documentation},
			insertTextFormat : InsertTextFormat.PlainText,
			insertText : variable,
		})
	})

		commandList.commands.forEach((elem) => {
			elem.matchKeyword.forEach((match) => {
				listCommands.push({
					label: elem.keyword,
					labelDetails: {
						description : elem.quickText
					},
					kind: CompletionItemKind.Keyword,
					sortText : match,
					filterText : match,
					detail : elem.detail,
					documentation : elem.documentation, //{ kind : "markdown" ,value : elem.documentation},
					insertTextFormat : InsertTextFormat.Snippet,
					insertText : elem.insertText,
				});
			})
		});
		console.log("Liste de commandes", listCommands[0])
		return listCommands;
	};

}

module.exports = {autoCompletion};