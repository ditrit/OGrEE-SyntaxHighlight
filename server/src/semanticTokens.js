const tokensConfig = require("../data/semantic_tokens.json");

export function encodeTokenType(tokenType, genericToken = false) {
	if (tokensConfig.tokenTypes.includes(genericToken ? tokenType : tokensConfig.types[tokenType])) {
		return tokensConfig.tokenTypes.indexOf(genericToken ? tokenType : tokensConfig.types[tokenType]);
	}
	return 0;
}

export function encodeTokenModifiers(strTokenModifiers) {
	let result = 0;
	for (let i = 0; i < strTokenModifiers.length; i++) {
		const tokenModifier = strTokenModifiers[i];
		if (tokensConfig.tokenModifiers.includes(tokenModifier)) {
			result = result | (1 << tokensConfig.tokenModifiers.indexOf(tokenModifier));
		} else if (tokenModifier === 'notInLegend') {
			result = result | (1 << tokensConfig.tokenModifiers.size + 2);
		}
	}
	return result;
}

function parseText(text){
	const r = [];
	const lines = text.split(/\r\n|\r|\n/);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		let currentOffset = 0;
		do {
			const openOffset = line.indexOf('[', currentOffset);
			//console.log("Token trouvé, ")
			if (openOffset === -1) {
				break;
			}
			const closeOffset = line.indexOf(']', openOffset);
			if (closeOffset === -1) {
				break;
			}
			const tokenData = parseTextToken(line.substring(openOffset + 1, closeOffset));
			r.push({
				line: i,
				startCharacter: openOffset + 1,
				length: closeOffset - openOffset - 1,
				tokenType: tokenData.tokenType,
				tokenModifiers: tokenData.tokenModifiers
			});
			currentOffset = closeOffset;
		} while (true);
	}
	return r;
}

function parseTextToken(text) {
	const parts = text.split('.');
	return {
		tokenType: parts[0],
		tokenModifiers: parts.slice(1)
	};
}

export function semanticTokenProvider(document){
	//let tokenList = [{line : 1, char : 2, length : 7, tokenType : getTokenIndex("string"), tokenModifiers : getTokenMoifierIndex("deprecated")}];
	let result = []
	const tokenList = parseText(document);
	tokenList.forEach((token) => {
		result.push({line : token.line, char : token.startCharacter, length : token.length, tokenType : encodeTokenType(token.tokenType), tokenModifiers :encodeTokenModifiers(token.tokenModifiers)});
	});
	return result
}

module.exports = {semanticTokenProvider, encodeTokenType, encodeTokenModifiers}