const tokensConfig = require("../data/semantic_tokens.json");

function getTokenIndex(tokenType){
	return tokensConfig.tokenTypes.indexOf(tokenType);
}

function getTokenMoifierIndex(tokenModifier){
	return tokensConfig.tokenModifiers.indexOf(tokenModifier);
}

export function semanticTokenProvider(document){
	let tokenList = [{line : 1, char : 2, length : 7, tokenType : getTokenIndex("string"), tokenModifiers : getTokenMoifierIndex("deprecated")}];

	return tokenList
}

module.exports = {semanticTokenProvider}