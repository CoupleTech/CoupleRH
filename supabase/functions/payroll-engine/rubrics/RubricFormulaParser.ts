export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

export class RubricFormulaParser {
  private variables: Record<string, number>;

  constructor(variables: Record<string, number>) {
    this.variables = variables;
  }

  public evaluate(formula: string): number {
    if (!formula || formula.trim() === '') return 0;
    
    let expr = formula;
    for (const [key, value] of Object.entries(this.variables)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        expr = expr.replace(regex, value.toString());
    }

    const tokens = this.tokenize(expr);
    const ast = this.parse(tokens);
    return this.evalAst(ast);
  }

  private tokenize(expr: string): string[] {
    const regex = /\s*([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[\+\-\*\/\%\(\)\,])\s*/g;
    const tokens: string[] = [];
    let match;
    while ((match = regex.exec(expr)) !== null) {
      tokens.push(match[1]);
    }
    return tokens;
  }

  private parse(tokens: string[]): any {
    let pos = 0;
    const peek = (offset = 0) => tokens[pos + offset];
    const consume = () => tokens[pos++];

    const parseExpr = (): any => {
      let node = parseTerm();
      while (peek() === '+' || peek() === '-') {
        const op = consume();
        const right = parseTerm();
        node = { type: 'Binary', op, left: node, right };
      }
      return node;
    };

    const parseTerm = (): any => {
      let node = parseFactor();
      while (peek() === '*' || peek() === '/' || peek() === '%') {
        const op = consume();
        const right = parseFactor();
        node = { type: 'Binary', op, left: node, right };
      }
      return node;
    };

    const parseFactor = (): any => {
      const token = peek();
      if (!token) throw new FormulaError('Unexpected end of formula');

      if (token === '-') {
        consume();
        return { type: 'Unary', op: '-', right: parseFactor() };
      }

      if (token === '(') {
        consume();
        const node = parseExpr();
        if (consume() !== ')') throw new FormulaError('Expected )');
        return node;
      }

      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
        if (peek(1) === '(') {
            const funcName = consume();
            consume(); // '('
            const args = [];
            if (peek() !== ')') {
              args.push(parseExpr());
              while (peek() === ',') {
                consume();
                args.push(parseExpr());
              }
            }
            if (consume() !== ')') throw new FormulaError(`Expected ) after function args for ${funcName}`);
            return { type: 'Call', name: funcName, args };
        } else {
            // It's a variable that wasn't replaced (meaning it's 0 / undefined / untriggered)
            consume();
            return { type: 'Literal', value: 0 };
        }
      }

      if (!isNaN(parseFloat(token))) {
        consume();
        return { type: 'Literal', value: parseFloat(token) };
      }

      throw new FormulaError(`Unexpected token: ${token}`);
    };

    const ast = parseExpr();
    if (pos < tokens.length) {
       throw new FormulaError(`Unexpected token at end: ${tokens[pos]}`);
    }
    return ast;
  }

  private evalAst(node: any): number {
    switch (node.type) {
      case 'Literal':
        return node.value;
      case 'Binary':
        const left = this.evalAst(node.left);
        const right = this.evalAst(node.right);
        switch (node.op) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/': return left / right;
          case '%': return left % right;
        }
        break;
      case 'Unary':
        if (node.op === '-') return -this.evalAst(node.right);
        break;
      case 'Call':
        const args = node.args.map((a: any) => this.evalAst(a));
        switch (node.name.toUpperCase()) {
          case 'MIN': return Math.min(...args);
          case 'MAX': return Math.max(...args);
          case 'IF': return args[0] !== 0 ? args[1] : args[2]; 
          case 'ROUND': return Math.round(args[0] * 100) / 100;
          default: throw new FormulaError(`Unknown function: ${node.name}`);
        }
    }
    throw new FormulaError('Invalid AST node');
  }
}
