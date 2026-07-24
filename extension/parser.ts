const Parser = require('tree-sitter');
const JavaScript = require('tree-sitter-javascript');
const TypeScript = require('tree-sitter-typescript').typescript;
const Python = require('tree-sitter-python');

export class ASTParser {
    private jsParser: any;
    private tsParser: any;
    private pyParser: any;

    constructor() {
        this.jsParser = new Parser();
        this.jsParser.setLanguage(JavaScript);

        this.tsParser = new Parser();
        this.tsParser.setLanguage(TypeScript);

        this.pyParser = new Parser();
        this.pyParser.setLanguage(Python);
    }

    public analyzeComplexity(filePath: string, fileContent: string): number {
        let tree: any = null;

        if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
            tree = this.jsParser.parse(fileContent);
        } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
            tree = this.tsParser.parse(fileContent);
        } else if (filePath.endsWith('.py')) {
            tree = this.pyParser.parse(fileContent);
        }

        if (!tree) {
            return 0; // Unsupported file type
        }

        return this.countComplexNodes(tree.rootNode);
    }

    private countComplexNodes(node: any): number {
        let count = 0;
        
        // Tree-sitter node types that represent complex logic
        const complexTypes = [
            'if_statement', 'for_statement', 'while_statement', 
            'try_statement', 'catch_clause', 'switch_statement',
            'elif_clause', 'except_clause', 'arrow_function'
        ];

        if (complexTypes.includes(node.type)) {
            count++;
        }

        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) {
                count += this.countComplexNodes(child);
            }
        }

        return count;
    }
}
