export class SemanticTokensProvider extends SemanticTokensProvider{
	provideDocumentSemanticTokens(document, token) {
		const tokens = [{ line: 2, startChar: 10, length: 4, tokenType: "function", tokenModifiers: [] }];
		return tokens;
	}
}