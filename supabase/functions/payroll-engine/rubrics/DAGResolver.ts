import { Rubric } from '../engine/PayrollContext.ts';

export class CircularDependencyException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircularDependencyException';
  }
}

export class DAGResolver {
  public static resolve(rubrics: Map<string, Rubric>): Rubric[] {
    const sorted: Rubric[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const graph = new Map<string, string[]>();
    const allRubrics = Array.from(rubrics.values());

    for (const rubric of allRubrics) {
      const deps: string[] = [];
      // Se a rubrica usar outra rubrica como base (pelo ID ou Code), adicionamos a dependência.
      if (rubric.calculation_base) {
         // Tentativa de achar pelo ID ou pelo CODE
         const depId = rubrics.has(rubric.calculation_base) 
            ? rubric.calculation_base 
            : allRubrics.find(r => r.code === rubric.calculation_base)?.id;
            
         if (depId) {
             deps.push(depId);
         }
      }
      graph.set(rubric.id, deps);
    }

    const visit = (rubricId: string) => {
      if (recursionStack.has(rubricId)) {
        throw new CircularDependencyException(`Dependência circular detectada envolvendo a rubrica: ${rubricId}`);
      }
      if (visited.has(rubricId)) return;

      recursionStack.add(rubricId);
      
      const deps = graph.get(rubricId) || [];
      for (const dep of deps) {
        visit(dep);
      }

      recursionStack.delete(rubricId);
      visited.add(rubricId);
      
      const r = rubrics.get(rubricId);
      if (r) sorted.push(r);
    };

    // Ordenação primária por calculation_order
    allRubrics.sort((a, b) => a.calculation_order - b.calculation_order);

    for (const rubric of allRubrics) {
      if (!visited.has(rubric.id)) {
        visit(rubric.id);
      }
    }

    return sorted;
  }
}
