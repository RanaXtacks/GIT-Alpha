/**
 * Fast, pure-TypeScript structural code complexity parser.
 * Analyzes control flow constructs without requiring heavy native C++ binaries.
 */
export class ASTParser {
    /**
     * Calculates cyclomatic structural complexity score by inspecting control flow nodes
     */
    public analyzeComplexity(filePath: string, fileContent: string): number {
        // Strip string literals and comments to prevent false matches inside comments/strings
        const cleanedContent = this.stripCommentsAndStrings(fileContent);

        // Control flow keywords across JS/TS/Python
        const pattern = /\b(if|else\s+if|elif|for|while|do|switch|case|catch|except|finally)\b|\?\?/g;
        const matches = cleanedContent.match(pattern);

        return matches ? matches.length : 0;
    }

    /**
     * Removes string literals and comments to ensure accurate keyword counting
     */
    private stripCommentsAndStrings(content: string): string {
        return content
            // Remove single-line comments (// or #)
            .replace(/\/\/.*$|#.*$/gm, '')
            // Remove multi-line comments (/* ... */ or ''' ... ''')
            .replace(/\/\*[\s\S]*?\*\/|'''[\s\S]*?'''|"""[\s\S]*?"""/g, '')
            // Remove double & single quoted strings
            .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    }
}
