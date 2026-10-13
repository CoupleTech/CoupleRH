import { round2 } from '../utils/money.ts';

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

type TokenType =
  | 'NUMBER'
  | 'IDENTIFIER'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

type ASTNode =
  | { type: 'Literal'; value: number }
  | { type: 'Variable'; name: string }
  | { type: 'Unary'; op: string; right: ASTNode }
  | { type: 'Binary'; op: string; left: ASTNode; right: ASTNode }
  | { type: 'Call'; name: string; args: ASTNode[] };

export class RubricFormulaParser {
  private variables: Record<string, number>;
  private knownRubrics: Set<string>;

  constructor(variables: Record<string, number>, knownRubrics?: Set<string> | string[]) {
    this.variables = variables;
    this.knownRubrics = knownRubrics instanceof Set 
      ? knownRubrics 
      : new Set(knownRubrics || []);
  }

  public evaluate(formula: string): number {
    if (!formula || formula.trim() === '') return 0;

    const normalized = this.normalize(formula);
    const tokens = this.tokenize(normalized);
    const ast = this.parse(tokens);
    const result = this.evalAst(ast);

    if (isNaN(result) || !isFinite(result)) {
      throw new FormulaError('Resultado numérico inválido (NaN ou infinito) na fórmula');
    }

    return round2(result);
  }

  /**
   * Normaliza vírgula decimal mantendo vírgulas separadoras de argumentos em funções intactas.
   * Ex: "150,00" -> "150.00", ",5" -> "0.5", "0,5" -> "0.5", mas "IF(A, B, C)" mantém as vírgulas.
   */
  private normalize(expr: string): string {
    // 1. Vírgula no início de número ou após operador/espaço seguido imediatamente por dígitos: ",5" -> "0.5"
    let res = expr.replace(/(^|[\s\+\-\*\/\%\(\<\>\=\&\|\!]),(\d+)/g, '$10.$2');
    // 2. Vírgula decimal entre dígitos: "150,00" -> "150.00"
    res = res.replace(/(\d+),(\d+)/g, '$1.$2');
    return res;
  }

  /**
   * Tokenizer estrito: rejeita qualquer caractere inesperado com FormulaError.
   */
  private tokenize(expr: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const len = expr.length;

    while (i < len) {
      const ch = expr[i];

      // Ignora espaços
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // Parênteses e vírgula
      if (ch === '(') {
        tokens.push({ type: 'LPAREN', value: '(', pos: i++ });
        continue;
      }
      if (ch === ')') {
        tokens.push({ type: 'RPAREN', value: ')', pos: i++ });
        continue;
      }
      if (ch === ',') {
        tokens.push({ type: 'COMMA', value: ',', pos: i++ });
        continue;
      }

      // Operadores de 2 caracteres: ==, !=, <=, >=, &&, ||
      const twoChars = expr.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoChars)) {
        tokens.push({ type: 'OPERATOR', value: twoChars, pos: i });
        i += 2;
        continue;
      }

      // Operadores de 1 caractere: <, >, +, -, *, /, %
      if (['<', '>', '+', '-', '*', '/', '%'].includes(ch)) {
        tokens.push({ type: 'OPERATOR', value: ch, pos: i++ });
        continue;
      }

      // Números (suporta literais iniciados com ponto ex: .5 ou padrão 123.45)
      if (/\d/.test(ch) || (ch === '.' && i + 1 < len && /\d/.test(expr[i + 1]))) {
        let numStr = '';
        const startPos = i;
        while (i < len && (/[\d\.]/.test(expr[i]))) {
          numStr += expr[i++];
        }
        tokens.push({ type: 'NUMBER', value: numStr, pos: startPos });
        continue;
      }

      // Identificadores (variáveis e nomes de função): [A-Za-z_][A-Za-z0-9_]*
      if (/[A-Za-z_]/.test(ch)) {
        let idStr = '';
        const startPos = i;
        while (i < len && /[A-Za-z0-9_]/.test(expr[i])) {
          idStr += expr[i++];
        }
        tokens.push({ type: 'IDENTIFIER', value: idStr, pos: startPos });
        continue;
      }

      // Caractere inválido ou desconhecido -> Erro estrito
      throw new FormulaError(`Caractere inválido ou inesperado na fórmula: '${ch}' na posição ${i}`);
    }

    return tokens;
  }

  /**
   * Parser descendente recursivo com precedência de operadores clássica.
   */
  private parse(tokens: Token[]): ASTNode {
    let pos = 0;

    const peek = (offset = 0): Token | undefined => tokens[pos + offset];
    const consume = (): Token => tokens[pos++];

    const parseExpression = (): ASTNode => parseLogicalOr();

    const parseLogicalOr = (): ASTNode => {
      let node = parseLogicalAnd();
      while (peek()?.type === 'OPERATOR' && peek()?.value === '||') {
        const op = consume().value;
        const right = parseLogicalAnd();
        node = { type: 'Binary', op, left: node, right };
      }
      return node;
    };

    const parseLogicalAnd = (): ASTNode => {
      let node = parseEquality();
      while (peek()?.type === 'OPERATOR' && peek()?.value === '&&') {
        const op = consume().value;
        const right = parseEquality();
        node = { type: 'Binary', op, left: node, right };
      }
      return node;
    };

    const parseEquality = (): ASTNode => {
      let node = parseRelational();
      while (peek()?.type === 'OPERATOR' && ['==', '!='].includes(peek()!.value)) {
        const op = consume().value;
        const right = parseRelational();
        node = { type: 'Binary', op, left: node, right };
      }
      return node;
    };

    const parseRelational = (): ASTNode => {
      let node = parseAdditive();
      while (peek()?.type === 'OPERATOR' && ['<', '<=', '>', '>='].includes(peek()!.value)) {
        const op = consume().value;
        const right = parseAdditive();
        node = { type: 'Binary', op, left: node, right };
      }
      return node;
    };

    const parseAdditive = (): ASTNode => {
      let node = parseMultiplicative();
      while (peek()?.type === 'OPERATOR' && ['+', '-'].includes(peek()!.value)) {
        const op = consume().value;
        const right = parseMultiplicative();
        node = { type: 'Binary', op, left: node, right };
      }
      return node;
    };

    const parseMultiplicative = (): ASTNode => {
      let node = parseUnary();
      while (peek()?.type === 'OPERATOR' && ['*', '/', '%'].includes(peek()!.value)) {
        const op = consume().value;
        const right = parseUnary();
        node = { type: 'Binary', op, left: node, right };
      }
      return node;
    };

    const parseUnary = (): ASTNode => {
      if (peek()?.type === 'OPERATOR' && peek()?.value === '-') {
        consume();
        return { type: 'Unary', op: '-', right: parseUnary() };
      }
      return parsePrimary();
    };

    const parsePrimary = (): ASTNode => {
      const token = peek();
      if (!token) {
        throw new FormulaError('Fim inesperado da expressão na fórmula');
      }

      if (token.type === 'NUMBER') {
        consume();
        const val = parseFloat(token.value);
        if (isNaN(val)) throw new FormulaError(`Número inválido na fórmula: '${token.value}'`);
        return { type: 'Literal', value: val };
      }

      if (token.type === 'IDENTIFIER') {
        const next = peek(1);
        if (next && next.type === 'LPAREN') {
          // Chamada de função: FUNC(...)
          const funcName = consume().value;
          consume(); // '('
          const args: ASTNode[] = [];
          if (peek() && peek()!.type !== 'RPAREN') {
            args.push(parseExpression());
            while (peek()?.type === 'COMMA') {
              consume(); // ','
              args.push(parseExpression());
            }
          }
          if (peek()?.type !== 'RPAREN') {
            throw new FormulaError(`Esperado ')' após argumentos da função '${funcName}'`);
          }
          consume(); // ')'
          return { type: 'Call', name: funcName, args };
        } else {
          // Variável
          consume();
          return { type: 'Variable', name: token.value };
        }
      }

      if (token.type === 'LPAREN') {
        consume(); // '('
        const node = parseExpression();
        if (peek()?.type !== 'RPAREN') {
          throw new FormulaError("Esperado ')' para fechar expressão");
        }
        consume(); // ')'
        return node;
      }

      throw new FormulaError(`Token inesperado: '${token.value}' na posição ${token.pos}`);
    };

    const ast = parseExpression();
    if (pos < tokens.length) {
      throw new FormulaError(`Token inesperado ao final da expressão: '${tokens[pos].value}'`);
    }

    return ast;
  }

  /**
   * Avaliação da AST garantindo tratamento estrito de variáveis, divisão por zero e funções.
   */
  private evalAst(node: ASTNode): number {
    switch (node.type) {
      case 'Literal':
        return node.value;

      case 'Variable': {
        const varName = node.name;
        // 1. Variável presente no mapa de variáveis
        if (varName in this.variables) {
          const val = this.variables[varName];
          return typeof val === 'number' ? val : Number(val);
        }

        // 2. Se for código de rubrica com prefixo R (ex: R150)
        if (/^R\d+$/i.test(varName)) {
          const code = varName.slice(1);
          // Se a rubrica pertence ao catálogo do tenant, mas não foi acionada no mês, o valor é 0
          if (this.knownRubrics.has(code) || this.knownRubrics.has(varName)) {
            return 0;
          }
        }

        // 3. Variável inexistente -> Erro explícito
        throw new FormulaError(`Variável '${varName}' não encontrada no contexto de cálculo`);
      }

      case 'Unary': {
        if (node.op === '-') {
          return -this.evalAst(node.right);
        }
        throw new FormulaError(`Operador unário não suportado: '${node.op}'`);
      }

      case 'Binary': {
        const left = this.evalAst(node.left);
        const right = this.evalAst(node.right);

        switch (node.op) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/':
            if (right === 0) throw new FormulaError('Divisão por zero na fórmula');
            return left / right;
          case '%':
            if (right === 0) throw new FormulaError('Divisão por zero na fórmula');
            return left % right;

          case '==': return Math.abs(left - right) < 0.000001 ? 1 : 0;
          case '!=': return Math.abs(left - right) >= 0.000001 ? 1 : 0;
          case '<': return left < right ? 1 : 0;
          case '<=': return left <= right ? 1 : 0;
          case '>': return left > right ? 1 : 0;
          case '>=': return left >= right ? 1 : 0;

          case '&&': return left !== 0 && right !== 0 ? 1 : 0;
          case '||': return left !== 0 || right !== 0 ? 1 : 0;

          default:
            throw new FormulaError(`Operador binário desconhecido: '${node.op}'`);
        }
      }

      case 'Call': {
        const funcName = node.name.toUpperCase();
        const args = node.args.map(a => this.evalAst(a));

        switch (funcName) {
          case 'MIN':
            if (args.length === 0) throw new FormulaError('Função MIN requer ao menos 1 argumento');
            return Math.min(...args);
          case 'MAX':
            if (args.length === 0) throw new FormulaError('Função MAX requer ao menos 1 argumento');
            return Math.max(...args);
          case 'IF':
            if (args.length < 2 || args.length > 3) {
              throw new FormulaError('Função IF requer 2 ou 3 argumentos: IF(condicao, se_verdadeiro, se_falso)');
            }
            return args[0] !== 0 ? args[1] : (args[2] !== undefined ? args[2] : 0);
          case 'ROUND':
            if (args.length === 0) throw new FormulaError('Função ROUND requer 1 argumento');
            return round2(args[0]);
          default:
            throw new FormulaError(`Função desconhecida na fórmula: '${node.name}'`);
        }
      }

      default:
        throw new FormulaError('Nó de AST desconhecido');
    }
  }
}
