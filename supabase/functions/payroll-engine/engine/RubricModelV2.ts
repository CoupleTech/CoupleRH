import { RubricKind } from "./PayrollContext.ts";

export type RubricContext = "MONTHLY" | "VACATION" | "THIRTEENTH" | "TERMINATION" | "ALL";
export type RubricStatus = "DRAFT" | "APPROVED" | "ACTIVE" | "RETIRED";
export type IrrfMode = "NORMAL" | "EXCLUSIVO" | "TABELA_PLR" | "ISENTO";

export interface RubricModelV2 {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  type: "EARNING" | "DEDUCTION" | "BASE";
  rubric_kind?: RubricKind;
  esocial_nature?: string;
  is_system?: boolean;
  version?: number;
  valid_from?: string | null;
  valid_to?: string | null;
  status: RubricStatus;
  legal_basis?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  // Campos legados para fallback
  generates_base_inss?: boolean;
  generates_base_irrf?: boolean;
  generates_base_fgts?: boolean;
  incidence_inss_patronal?: boolean;
  incidence_rat?: boolean;
  incidence_third_parties?: boolean;
  incidencias?: {
    gera_base_inss?: boolean;
    gera_base_irrf?: boolean;
    gera_base_fgts?: boolean;
  };
}

export interface RubricIncidenceRecord {
  id?: string;
  tenant_id?: string;
  rubric_id: string;
  context: RubricContext;
  inss: boolean;
  irrf: boolean;
  fgts: boolean;
  irrf_mode?: IrrfMode;
  integra_dsr: boolean;
  media_ferias: boolean;
  media_13: boolean;
  inss_patronal: boolean;
  rat: boolean;
  terceiros: boolean;
}

export interface CalculationBaseDefinition {
  code: string;
  name: string;
  description?: string;
  is_system?: boolean;
}

export interface CalculationBaseMemberRecord {
  id?: string;
  base_code: string;
  rubric_id?: string;
  kind?: RubricKind | string;
  operation: "ADD" | "SUBTRACT";
}

export interface ResolvedBaseMembers {
  addRubricIds: string[];
  subtractRubricIds: string[];
}

/**
 * Resolve as incidências tributárias e de reflexos de uma rubrica para um contexto específico (T9/§6).
 * Busca precedência:
 * 1. Contexto específico (ex: 'MONTHLY' ou 'TERMINATION')
 * 2. Contexto universal 'ALL'
 * 3. Fallback para as colunas estruturais da própria rubrica
 */
export function resolveRubricIncidence(
  rubric: RubricModelV2,
  context: RubricContext,
  incidences: RubricIncidenceRecord[] = []
): RubricIncidenceRecord {
  // 1. Procura incidência do contexto exato
  const exactMatch = incidences.find(
    (i) => i.rubric_id === rubric.id && i.context === context
  );
  if (exactMatch) return exactMatch;

  // 2. Procura incidência universal 'ALL'
  const allMatch = incidences.find(
    (i) => i.rubric_id === rubric.id && i.context === "ALL"
  );
  if (allMatch) return allMatch;

  // 3. Fallback seguro para flags legadas da rubrica
  const inss = Boolean(
    rubric.generates_base_inss ?? rubric.incidencias?.gera_base_inss ?? false
  );
  const irrf = Boolean(
    rubric.generates_base_irrf ?? rubric.incidencias?.gera_base_irrf ?? false
  );
  const fgts = Boolean(
    rubric.generates_base_fgts ?? rubric.incidencias?.gera_base_fgts ?? false
  );
  const inss_patronal = Boolean(rubric.incidence_inss_patronal ?? inss);
  const rat = Boolean(rubric.incidence_rat ?? inss);
  const terceiros = Boolean(rubric.incidence_third_parties ?? inss);

  return {
    rubric_id: rubric.id,
    context,
    inss,
    irrf,
    fgts,
    irrf_mode: "NORMAL",
    integra_dsr: rubric.rubric_kind === "OVERTIME" || rubric.rubric_kind === "COMMISSION",
    media_ferias: true,
    media_13: true,
    inss_patronal,
    rat,
    terceiros,
  };
}

/**
 * Valida se uma rubrica está ativa e vigente para o período de cálculo (§6).
 */
export function isRubricEligibleForCalculation(
  status: RubricStatus,
  competenceDate?: string,
  validFrom?: string | null,
  validTo?: string | null,
  competenceStartDate?: string
): boolean {
  if (status !== "ACTIVE") {
    return false;
  }

  if (!competenceDate) {
    return true;
  }

  // Se competenceStartDate for fornecida, competenceDate atua como o fim da competência (competenceEndDate)
  // A rubrica só é inelegível por validFrom se passar a valer estritamente após o fim da competência
  if (validFrom && competenceDate < validFrom) {
    return false;
  }

  // A rubrica só é inelegível por validTo se tiver expirado antes do início da competência
  const effectiveStart = competenceStartDate || competenceDate;
  if (validTo && effectiveStart > validTo) {
    return false;
  }

  return true;
}

/**
 * Resolve quais IDs de rubricas adicionam ou subtraem em uma base dinâmica com base nos membros cadastrados (§6).
 */
export function resolveCalculationBaseMembers(
  baseCode: string,
  members: CalculationBaseMemberRecord[],
  rubrics: RubricModelV2[]
): ResolvedBaseMembers {
  const matchingMembers = members.filter((m) => m.base_code === baseCode);
  const addRubricIds = new Set<string>();
  const subtractRubricIds = new Set<string>();

  for (const m of matchingMembers) {
    for (const r of rubrics) {
      const matchById = m.rubric_id && m.rubric_id === r.id;
      const matchByKind = m.kind && r.rubric_kind && m.kind === r.rubric_kind;

      if (matchById || matchByKind) {
        if (m.operation === "SUBTRACT") {
          subtractRubricIds.add(r.id);
        } else {
          addRubricIds.add(r.id);
        }
      }
    }
  }

  return {
    addRubricIds: Array.from(addRubricIds),
    subtractRubricIds: Array.from(subtractRubricIds),
  };
}
