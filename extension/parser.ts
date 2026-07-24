export class ASTParser {
    private jsParser: any;
    private tsParser: any;
    private pyParser: any;
    private initialized = false;

    private init() {
        if (this.initialized) return;
        try {
            const Parser = require('tree-sitter');
            const JavaScript = require('tree-sitter-javascript');
            const TypeScriptModule = require('tree-sitter-typescript');
            const Python = require('tree-sitter-python');

            const TypeScript = TypeScriptModule.typescript || TypeScriptModule;

            this.jsParser = new Parser();
            this.jsParser.setLanguage(JavaScript);

            this.tsParser = new Parser();
            this.tsParser.setLanguage(TypeScript);

            this.pyParser = new Parser();
            this.pyParser.setLanguage(Python);
            this.initialized = true;
        } catch (err: any) {
            console.warn("Tree-sitter native binding failed to load, using regex fallback:", err);
        }
    }

    public analyzeComplexity(filePath: string, fileContent: string): number {
        this.init();

        if (this.initialized) {
            try {
                let tree: any = null;

                if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
                    tree = this.jsParser.parse(fileContent);
                } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
                    tree = this.tsParser.parse(fileContent);
                } else if (filePath.endsWith('.py')) {
                    tree = this.pyParser.parse(fileContent);
                }

                if (tree) {
                    if (tree.rootNode.hasError()) {
                        throw new Error(`Syntax error in ${filePath}`);
                    }
                    return this.countComplexNodes(tree.rootNode);
                }
            } catch (e) {
                throw e; // Propagate the error so the scanner marks it as a failed file
            }
        }

        // Fallback regex-based complexity matching if native tree-sitter binary is missing/incompatible
        return this.fallbackRegexComplexity(fileContent);
    }

    private fallbackRegexComplexity(content: string): number {
        const matches = content.match(/\b(if|for|while|try|catch|switch|elif|except)\b/g);
        return matches ? matches.length : 0;
    }

    private countComplexNodes(node: any): number {
        let count = 0;
        
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
