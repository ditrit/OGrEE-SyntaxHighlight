import {
	CompletionItemKind,InsertTextFormat
} from 'vscode-languageserver/node';

const commandList = require("./../data/command_list.json");

export function autoCompletion(){
	return (_textDocumentPosition) => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		var listCommands = [];
		commandList.commands.forEach((elem, index) => {
			listCommands.push({
						label: elem.keyword,
						labelDetails: {
							description : elem.quickText
						},
						kind: CompletionItemKind.Keyword,
						sortText : elem.matchKeyword,
						data: index,
						//detail : "Advanced details",
						documentation : elem.documentation,
						insertTextFormat : InsertTextFormat.Snippet,
						insertText : elem.insertText
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
		return listCommands;
	};

}

module.exports = {autoCompletion};