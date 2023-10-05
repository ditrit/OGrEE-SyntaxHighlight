import hljs from 'highlight.js';

function syntaxHighlight() {
    document.addEventListener('DOMContentLoaded', (event) => {
        const codeElements = document.querySelectorAll('pre code');
        Array.from(codeElements).forEach((element) => {
            hljs.highlightElement(element);
        });
    });
}

syntaxHighlight();