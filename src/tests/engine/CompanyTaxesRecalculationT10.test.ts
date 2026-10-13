import { describe, it, expect } from "vitest";
import {
  aggregateCompanyBases,
  calculateConsolidatedEmployerTaxes,
  type ExistingPayslipBase,
} from "../../../supabase/functions/payroll-engine/engine/CompanyTaxesAggregator";
import { LaborConfig } from "../../../supabase/functions/payroll-engine/legal/EmployerTaxesCalculator";

describe("T10: Impostos Patronais Recalculados a partir de Todos os Holerites do Período (Doc §4)", () => {
  const tenantId = "tenant-uuid-1";
  const periodId = "period-uuid-1";
  const companyA = "company-uuid-a";
  const companyB = "company-uuid-b";

  const defaultLaborConfig: LaborConfig = {
    inss_patronal_percentage: 20.0,
    rat_percentage: 2.0,
    fap_multiplier: 1.0,
    terceiros_percentage: 5.8,
  };

  it("1. Folha completa: deve somar as bases de todos os contratos calculados para a mesma empresa", () => {
    const calculatedPayslips = [
      {
        contract_id: "contract-1",
        base_inss: 3000.0,
        base_fgts: 3000.0,
      },
      {
        contract_id: "contract-2",
        base_inss: 4500.5,
        base_fgts: 4500.5,
      },
      {
        contract_id: "contract-3",
        base_inss: 2499.5,
        base_fgts: 2499.5,
      },
    ];

    const contractCompanyMap = {
      "contract-1": companyA,
      "contract-2": companyA,
      "contract-3": companyA,
    };

    const basesByCompany = aggregateCompanyBases({
      calculatedPayslips,
      existingPayslips: [],
      contractCompanyMap,
    });

    // Total base: 3000.00 + 4500.50 + 2499.50 = 10000.00
    expect(basesByCompany[companyA]).toBeDefined();
    expect(basesByCompany[companyA].base_inss).toBe(10000.0);
    expect(basesByCompany[companyA].base_fgts).toBe(10000.0);

    const taxes = calculateConsolidatedEmployerTaxes({
      tenant_id: tenantId,
      period_id: periodId,
      companyTotals: basesByCompany,
      companies: [{ id: companyA, labor_config: defaultLaborConfig }],
    });

    expect(taxes).toHaveLength(1);
    expect(taxes[0].company_id).toBe(companyA);
    expect(taxes[0].total_base_inss).toBe(10000.0);
    expect(taxes[0].total_base_fgts).toBe(10000.0);
    expect(taxes[0].inss_patronal).toBe(2000.0); // 20% de 10.000
    expect(taxes[0].rat_adjusted).toBe(200.0); // 2% de 10.000
    expect(taxes[0].terceiros).toBe(580.0); // 5.8% de 10.000
    expect(taxes[0].fgts_patronal).toBe(800.0); // 8% de 10.000
    expect(taxes[0].total_taxes).toBe(3580.0); // 2000 + 200 + 580 + 800
  });

  it("2. Recálculo por contrato único: deve somar os outros holerites já existentes do período com o novo holerite recalculado", () => {
    // Cenário: A empresa tem 3 colaboradores.
    // Os contratos 2 e 3 já estavam calculados na folha.
    // O usuário recalcula apenas o contrato 1 com novo salário/horas extras.
    const existingPayslips: ExistingPayslipBase[] = [
      {
        contract_id: "contract-2",
        company_id: companyA,
        base_inss: 4000.0,
        base_fgts: 4000.0,
      },
      {
        contract_id: "contract-3",
        company_id: companyA,
        base_inss: 6000.0,
        base_fgts: 6000.0,
      },
    ];

    // O contrato 1 foi recalculado com base de R$ 5.000
    const calculatedPayslips = [
      {
        contract_id: "contract-1",
        base_inss: 5000.0,
        base_fgts: 5000.0,
      },
    ];

    const contractCompanyMap = {
      "contract-1": companyA,
    };

    const basesByCompany = aggregateCompanyBases({
      calculatedPayslips,
      existingPayslips,
      contractCompanyMap,
    });

    // Base total da empresa DEVE ser 5.000 (novo) + 4.000 + 6.000 (outros) = 15.000
    // e NÃO apenas os 5.000 do contrato 1 isolado
    expect(basesByCompany[companyA].base_inss).toBe(15000.0);
    expect(basesByCompany[companyA].base_fgts).toBe(15000.0);

    const taxes = calculateConsolidatedEmployerTaxes({
      tenant_id: tenantId,
      period_id: periodId,
      companyTotals: basesByCompany,
      companies: [{ id: companyA, labor_config: defaultLaborConfig }],
    });

    expect(taxes).toHaveLength(1);
    expect(taxes[0].company_id).toBe(companyA);
    expect(taxes[0].total_base_inss).toBe(15000.0);
    expect(taxes[0].inss_patronal).toBe(3000.0); // 20% de 15.000
    expect(taxes[0].rat_adjusted).toBe(300.0); // 2% de 15.000
    expect(taxes[0].terceiros).toBe(870.0); // 5.8% de 15.000
    expect(taxes[0].fgts_patronal).toBe(1200.0); // 8% de 15.000
    expect(taxes[0].total_taxes).toBe(5370.0); // 3000 + 300 + 870 + 1200
  });

  it("3. Múltiplas empresas no mesmo período: deve consolidar as bases separadamente por empresa", () => {
    const calculatedPayslips = [
      { contract_id: "c-a1", base_inss: 5000.0, base_fgts: 5000.0 },
      { contract_id: "c-b1", base_inss: 8000.0, base_fgts: 8000.0 },
    ];

    const existingPayslips: ExistingPayslipBase[] = [
      {
        contract_id: "c-a2",
        company_id: companyA,
        base_inss: 3000.0,
        base_fgts: 3000.0,
      },
      {
        contract_id: "c-b2",
        company_id: companyB,
        base_inss: 2000.0,
        base_fgts: 2000.0,
      },
    ];

    const contractCompanyMap = {
      "c-a1": companyA,
      "c-b1": companyB,
    };

    const basesByCompany = aggregateCompanyBases({
      calculatedPayslips,
      existingPayslips,
      contractCompanyMap,
    });

    // Empresa A: 5000 + 3000 = 8000
    expect(basesByCompany[companyA].base_inss).toBe(8000.0);
    expect(basesByCompany[companyA].base_fgts).toBe(8000.0);

    // Empresa B: 8000 + 2000 = 10000
    expect(basesByCompany[companyB].base_inss).toBe(10000.0);
    expect(basesByCompany[companyB].base_fgts).toBe(10000.0);

    const taxes = calculateConsolidatedEmployerTaxes({
      tenant_id: tenantId,
      period_id: periodId,
      companyTotals: basesByCompany,
      companies: [
        { id: companyA, labor_config: defaultLaborConfig },
        { id: companyB, labor_config: defaultLaborConfig },
      ],
    });

    expect(taxes).toHaveLength(2);
    const taxA = taxes.find((t) => t.company_id === companyA);
    const taxB = taxes.find((t) => t.company_id === companyB);

    expect(taxA?.total_base_inss).toBe(8000.0);
    expect(taxA?.inss_patronal).toBe(1600.0);

    expect(taxB?.total_base_inss).toBe(10000.0);
    expect(taxB?.inss_patronal).toBe(2000.0);
  });

  it("4. Não deve duplicar contrato se ele estiver presente tanto em calculated quanto em existing", () => {
    const calculatedPayslips = [
      { contract_id: "c-1", base_inss: 6000.0, base_fgts: 6000.0 },
    ];

    // Se por acaso a lista de existing contiver c-1 com o valor antigo (4.000), o novo deve sobrepor
    const existingPayslips: ExistingPayslipBase[] = [
      { contract_id: "c-1", company_id: companyA, base_inss: 4000.0, base_fgts: 4000.0 },
      { contract_id: "c-2", company_id: companyA, base_inss: 3000.0, base_fgts: 3000.0 },
    ];

    const basesByCompany = aggregateCompanyBases({
      calculatedPayslips,
      existingPayslips,
      contractCompanyMap: { "c-1": companyA },
    });

    // Deve computar c-1 novo (6000) + c-2 (3000) = 9000, e descartar o c-1 antigo (4000)
    expect(basesByCompany[companyA].base_inss).toBe(9000.0);
  });
});
