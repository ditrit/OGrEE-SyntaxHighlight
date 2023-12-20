"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoCompletion = void 0;
const node_1 = require("vscode-languageserver/node");
const commandList = require("./../data/command_list.json");
function autoCompletion() {
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
                        description: elem.quickText
                    },
                    kind: node_1.CompletionItemKind.Keyword,
                    sortText: match,
                    filterText: match,
                    //detail : "Advanced details",
                    documentation: elem.documentation,
                    insertTextFormat: node_1.InsertTextFormat.Snippet,
                    insertText: elem.insertText
                });
            });
        });
        commandList.objects.forEach((elem) => {
            listCommands.push({
                label: elem,
                kind: node_1.CompletionItemKind.Text,
                data: listCommands.length
            });
        });
        commandList.args.forEach((elem) => {
            listCommands.push({
                label: elem,
                kind: node_1.CompletionItemKind.Text,
                data: listCommands.length
            });
        });
        return listCommands;
    };
}
exports.autoCompletion = autoCompletion;
module.exports = { autoCompletion };
//# sourceMappingURL=autoCompletion.js.map