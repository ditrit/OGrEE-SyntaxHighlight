import {
	CompletionItemKind,InsertTextFormat
} from 'vscode-languageserver/node';

const commandList = require("./../data/command_list.json");
//need to parse commmand list for easier use during document parsing

export function autoCompletion(variableName){
	return (_textDocumentPosition) => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		var listCommands = [];
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
					//detail : "Advanced details",
					documentation : elem.documentation, //{ kind : "markdown" ,value : elem.documentation},
					insertTextFormat : InsertTextFormat.Snippet,
					insertText : elem.insertText
				});
			});
		});
		commandList.objects.forEach((elem) => {
			listCommands.push({
				label: elem,
				kind: CompletionItemKind.Text,
				data: listCommands.length

			});
		});
		commandList.args.forEach((elem) => {
			listCommands.push({
				label: elem,
				kind: CompletionItemKind.Text,
				data: listCommands.length

			});
		});
		variableName.forEach((elem) => {
			listCommands.push({
				label: elem,
				kind: CompletionItemKind.Variable,

			})
		})
		return listCommands;
	};

}

module.exports = {autoCompletion};