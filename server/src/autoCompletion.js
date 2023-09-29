import {
	CompletionItemKind
} from 'vscode-languageserver/node';

export function autoCompletion(){
	return (_textDocumentPosition) => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			{
				label: 'TestChat',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}

}

module.exports = {autoCompletion}