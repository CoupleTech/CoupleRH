/**
 * Módulo de Apuração e Validação de Elegibilidade de Dependentes para IRRF (T19)
 * Legislação: Art. 35 da Lei nº 9.250/1995 e Instruções Normativas da Receita Federal do Brasil.
 */

export interface DependentInput {
  id?: string;
  person_id?: string;
  full_name?: string;
  cpf?: string | null;
  birth_date: string;
  relationship: 'SPOUSE' | 'CHILD' | 'PARENT' | 'OTHER' | string;
  is_irrf_dependent?: boolean;
  is_student?: boolean;
  is_incapacitated?: boolean;
}

export interface DependentEvaluationResult {
  eligibleCount: number;
  eligibleDependents: DependentInput[];
  rejectedDependents: {
    dependent: DependentInput;
    reason: string;
  }[];
}

/**
 * Calcula a idade que o dependente possui na competência (mês/ano) da folha.
 */
export function calculateAgeAtCompetence(birthDateStr: string, competenceYear: number, competenceMonth: number): number {
  if (!birthDateStr) return 0;
  const parts = birthDateStr.split('-');
  if (parts.length < 3) return 0;

  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10);

  let age = competenceYear - birthYear;
  if (competenceMonth < birthMonth) {
    age -= 1;
  }
  return Math.max(0, age);
}

/**
 * Avalia a lista de dependentes de um colaborador para fins de dedução da base de cálculo do IRRF.
 * Regras:
 * 1. is_irrf_dependent deve ser true.
 * 2. Deduplicação por CPF ou ID para evitar contagem em duplicidade.
 * 3. Filhos e outros dependentes sob guarda: limite de até 21 anos completos (ou até 24 se estudante universitário).
 * 4. Cônjuges/companheiros e pais: sem restrição de idade.
 */
export function evaluateIRRFDependents(
  dependents: DependentInput[],
  competenceYear: number,
  competenceMonth: number
): DependentEvaluationResult {
  const eligibleDependents: DependentInput[] = [];
  const rejectedDependents: { dependent: DependentInput; reason: string }[] = [];

  const seenCpfs = new Set<string>();
  const seenIds = new Set<string>();

  for (const dep of dependents) {
    // 1. Verificação da flag de dedução do IRRF
    if (dep.is_irrf_dependent === false) {
      rejectedDependents.push({
        dependent: dep,
        reason: "Dependente não marcado para abatimento de IRRF (is_irrf_dependent = false)",
      });
      continue;
    }

    // 2. Prevenção de duplicidade por ID
    if (dep.id) {
      if (seenIds.has(dep.id)) {
        rejectedDependents.push({
          dependent: dep,
          reason: "Dependente em duplicidade cadastral (mesmo ID já computado)",
        });
        continue;
      }
      seenIds.add(dep.id);
    }

    // 3. Prevenção de duplicidade por CPF
    if (dep.cpf) {
      const cleanCpf = dep.cpf.replace(/\D/g, '');
      if (cleanCpf.length > 0) {
        if (seenCpfs.has(cleanCpf)) {
          rejectedDependents.push({
            dependent: dep,
            reason: `Dependente em duplicidade cadastral (CPF ${dep.cpf} já computado para este declarante)`,
          });
          continue;
        }
        seenCpfs.add(cleanCpf);
      }
    }

    // 4. Verificação de idade e parentesco
    const rel = (dep.relationship || '').toUpperCase();
    const age = calculateAgeAtCompetence(dep.birth_date, competenceYear, competenceMonth);

    if (rel === 'CHILD' || rel === 'OTHER') {
      const maxAge = dep.is_student ? 24 : 21;
      if (age > maxAge && !dep.is_incapacitated) {
        rejectedDependents.push({
          dependent: dep,
          reason: `Idade de ${age} anos excede o limite legal de ${maxAge} anos para dedução fiscal de filho/dependente comum (Art. 35 Lei 9.250/95)`,
        });
        continue;
      }
    }

    // Aprovado
    eligibleDependents.push(dep);
  }

  return {
    eligibleCount: eligibleDependents.length,
    eligibleDependents,
    rejectedDependents,
  };
}
