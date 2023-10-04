from pygls.server import LanguageServer
from lsprotocol.types import TEXT_DOCUMENT_COMPLETION, CompletionOptions, CompletionParams, CompletionList, CompletionItem

server = LanguageServer('example-server', 'v0.1')

server.start_tcp('127.0.0.1', 8080)

@server.feature(TEXT_DOCUMENT_COMPLETION, CompletionOptions(trigger_characters=[',']))
def completions(params: CompletionParams):
    """Returns completion items."""
    return CompletionList(
        is_incomplete=False,
        items=[
            CompletionItem(label='Item1'),
            CompletionItem(label='Item2'),
            CompletionItem(label='Item3'),
        ]
    )

@server.command('myVerySpecialCommandName')
def cmd_return_hello_world(ls, *args):
    return 'Hello World!'