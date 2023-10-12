const { Color } = require('vscode-languageserver-types');


// Fonction pour analyser le document et extraire les informations de coloration
function parseDocumentForColors(document, text) {
	// Ici, vous pouvez implémenter la logique pour analyser le texte du document
	// et extraire les informations de coloration (par exemple, en recherchant des mots-clés, des commentaires, etc.).
	const colors = [];

	// Exemple : recherche des mots-clés "function" et "if"
	const keywordRegex = /\b(function|if)\b/g;
	let match;

	while ((match = keywordRegex.exec(text)) !== null) {
		const start = match.index;
		const end = match.index + 5;
		colors.push({
			range: {
				start: document.positionAt(start),
				end: document.positionAt(end)
			},
			color: Color.create(0, 1, 0, 1)
		}
		)

		return colors;
	}
}

// Événement déclenché lorsque la coloration syntaxique est demandée par l'éditeur client
export function docColor(documents) {
	return (params) => {
		const document = documents.get(params.textDocument.uri);
		if (!document) {
			return null;
		}

		const text = document.getText();
		const colors = parseDocumentForColors(document, text);

		return colors.map((color) => ({
			textDocument : document.uri,
			range: color.range,	
			color: color.color,
		}));
	};
}

module.exports = { docColor };
