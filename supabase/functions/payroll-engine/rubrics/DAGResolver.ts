import { Rubric } from '../engine/PayrollContext.ts';

export class CircularDependencyException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircularDependencyException';
  }
}

export class DAGResolver {
  /**
   * Ordena as rubricas topologicamente resolvendo dependências de:
   * 1. calculation_base explícita (ID ou código com/sem prefixo R)
   * 2. Bases dinâmicas (BASE_DSR, BASE_DSR_NOTURNO, BASE_HORA_EXTRA)
   * 3. Referências em fórmulas (R\d+ ou código direto da rubrica)
   * 4. Desempate determinístico por calculation_order (com fallback seguro 100) e código.
   */
  public static resolve(rubrics: Map<string, Rubric>): Rubric[] {
    const sorted: Rubric[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const currentPath: string[] = [];

    const graph = new Map<string, string[]>();
    const allRubrics = Array.from(rubrics.values());

    const compareRubrics = (a: Rubric, b: Rubric): number => {
      const orderA = a.calculation_order ?? 100;
      const orderB = b.calculation_order ?? 100;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return (a.code || '').localeCompare(b.code || '');
    };

    // Funções auxiliares para classificação de bases dinâmicas
    const isOvertime = (r: Rubric): boolean => {
      if (r.type !== 'EARNING') return false;
      return (
        r.rubric_kind === 'OVERTIME' ||
        r.category === 'OVERTIME' ||
        (r.name || '').toUpperCase().includes('HORA EXTRA') ||
        ['101', '102', '806'].includes(r.code)
      );
    };

    const isCommission = (r: Rubric): boolean => {
      if (r.type !== 'EARNING') return false;
      const upper = (r.name || '').toUpperCase();
      return (
        r.rubric_kind === 'COMMISSION' ||
        r.category === 'COMMISSION' ||
        upper.includes('COMISSAO') ||
        upper.includes('COMISSÃO')
      );
    };

    const isAdicNoturno = (r: Rubric): boolean => {
      if (r.type !== 'EARNING') return false;
      const upper = (r.name || '').toUpperCase();
      const isDsrNot = upper.includes('DSR');
      return (
        r.rubric_kind === 'ADIC_NOTURNO' ||
        r.rubric_kind === 'NIGHT_SHIFT' ||
        r.code === '301' ||
        (upper.includes('NOTURNO') && !isDsrNot)
      );
    };

    const isInsalubridade = (r: Rubric): boolean => {
      if (r.type !== 'EARNING') return false;
      const upper = (r.name || '').toUpperCase();
      return (
        r.rubric_kind === 'INSALUBRIDADE' ||
        r.rubric_kind === 'UNHEALTHY' ||
        r.code === '150' ||
        upper.includes('INSALUBRIDADE')
      );
    };

    const isPericulosidade = (r: Rubric): boolean => {
      if (r.type !== 'EARNING') return false;
      const upper = (r.name || '').toUpperCase();
      return (
        r.rubric_kind === 'PERICULOSIDADE' ||
        r.rubric_kind === 'HAZARD' ||
        r.code === '151' ||
        upper.includes('PERICULOSIDADE')
      );
    };

    const isDsr = (r: Rubric): boolean => {
      const upper = (r.name || '').toUpperCase();
      return (
        r.rubric_kind === 'DSR' ||
        r.code === '103' ||
        r.code === '104' ||
        (upper.includes('DSR') && !upper.includes('NOTURNO'))
      );
    };

    const isDsrNoturno = (r: Rubric): boolean => {
      const upper = (r.name || '').toUpperCase();
      return (
        r.rubric_kind === 'DSR_NOTURNO' ||
        r.code === '105' ||
        (upper.includes('DSR') && upper.includes('NOTURNO'))
      );
    };

    // Montagem do grafo de dependências
    for (const rubric of allRubrics) {
      const depsSet = new Set<string>();

      // 1. Dependência por calculation_base explícita
      if (rubric.calculation_base) {
        if (rubrics.has(rubric.calculation_base) && rubric.calculation_base !== rubric.id) {
          depsSet.add(rubric.calculation_base);
        } else {
          const directCodeDep = allRubrics.find(
            other =>
              other.id !== rubric.id &&
              (other.code === rubric.calculation_base || `R${other.code}` === rubric.calculation_base)
          );
          if (directCodeDep) {
            depsSet.add(directCodeDep.id);
          }
        }
      }

      // 2. Bases dinâmicas
      // 2.1 BASE_DSR: depende de OVERTIME, COMMISSION e ADIC_NOTURNO
      if (rubric.calculation_base === 'BASE_DSR' || isDsr(rubric)) {
        for (const other of allRubrics) {
          if (other.id !== rubric.id && (isOvertime(other) || isCommission(other) || isAdicNoturno(other))) {
            depsSet.add(other.id);
          }
        }
      }

      // 2.2 BASE_DSR_NOTURNO: depende de ADIC_NOTURNO
      if (rubric.calculation_base === 'BASE_DSR_NOTURNO' || isDsrNoturno(rubric)) {
        for (const other of allRubrics) {
          if (other.id !== rubric.id && isAdicNoturno(other)) {
            depsSet.add(other.id);
          }
        }
      }

      // 2.3 BASE_HORA_EXTRA: depende de adicionais habituais (insalubridade, periculosidade, adicional noturno)
      if (rubric.calculation_base === 'BASE_HORA_EXTRA') {
        for (const other of allRubrics) {
          if (other.id !== rubric.id && (isInsalubridade(other) || isPericulosidade(other) || isAdicNoturno(other))) {
            depsSet.add(other.id);
          }
        }
      }

      // 2.4 1/3 Constitucional de Férias (502 / 504)
      if (rubric.code === '502' || rubric.code === '504') {
        const targetCode = rubric.code === '502' ? '501' : '503';
        const baseRubric = allRubrics.find(o => o.code === targetCode);
        if (baseRubric && baseRubric.id !== rubric.id) {
          depsSet.add(baseRubric.id);
        }
      }

      // 3. Dependências extraídas da fórmula
      if (rubric.formula && rubric.formula.trim() !== '') {
        // 3.1 Identificadores R\d+
        const rMatches = rubric.formula.matchAll(/\bR(\d+)\b/gi);
        for (const match of rMatches) {
          const code = match[1];
          const matchedRubric = allRubrics.find(o => o.code === code);
          if (matchedRubric && matchedRubric.id !== rubric.id) {
            depsSet.add(matchedRubric.id);
          }
        }

        // 3.2 Códigos diretos de rubricas existentes no catálogo
        for (const other of allRubrics) {
          if (other.id === rubric.id || !other.code) continue;
          const codeRegex = new RegExp(`\\b${other.code}\\b`);
          if (codeRegex.test(rubric.formula)) {
            depsSet.add(other.id);
          }
        }
      }

      // Ordena as dependências de cada nó de forma determinística
      const sortedDeps = Array.from(depsSet)
        .map(id => rubrics.get(id)!)
        .filter(Boolean)
        .sort(compareRubrics)
        .map(r => r.id);

      graph.set(rubric.id, sortedDeps);
    }

    // Algoritmo DFS com detecção de ciclos e ordenação topológica
    const visit = (rubricId: string) => {
      if (recursionStack.has(rubricId)) {
        const cycleStartIndex = currentPath.indexOf(rubricId);
        const cycleIds = [...currentPath.slice(cycleStartIndex), rubricId];
        const cycleDescription = cycleIds
          .map(id => {
            const r = rubrics.get(id);
            return r ? `[${r.code}] ${r.name}` : id;
          })
          .join(' -> ');

        throw new CircularDependencyException(
          `Dependência circular detectada no cálculo de rubricas: ${cycleDescription}`
        );
      }

      if (visited.has(rubricId)) return;

      recursionStack.add(rubricId);
      currentPath.push(rubricId);

      const deps = graph.get(rubricId) || [];
      for (const depId of deps) {
        visit(depId);
      }

      currentPath.pop();
      recursionStack.delete(rubricId);
      visited.add(rubricId);

      const r = rubrics.get(rubricId);
      if (r) sorted.push(r);
    };

    // Ordenação primária por calculation_order (com fallback ?? 100) e desempate por code
    allRubrics.sort(compareRubrics);

    for (const rubric of allRubrics) {
      if (!visited.has(rubric.id)) {
        visit(rubric.id);
      }
    }

    return sorted;
  }
}
