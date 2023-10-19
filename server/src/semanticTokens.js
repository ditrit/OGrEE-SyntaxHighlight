
export function semanticTokenProvider(document){
	let tokenList = [{line : 1, char : 2, length : 7, tokenType : 1, tokenModifiers : 0}];

	return tokenList
}

module.exports = {semanticTokenProvider}