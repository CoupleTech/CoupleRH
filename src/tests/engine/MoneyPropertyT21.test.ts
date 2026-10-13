import { describe, it, expect } from 'vitest';
import {
  round2,
  toCents,
  fromCents,
  addMoney,
  subtractMoney,
  multiplyMoney,
  divideMoney,
  sumMoney,
  moneyEquals
} from '../../../supabase/functions/payroll-engine/utils/money';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';

describe('T21 - Precisão Monetária (money.ts) e Teste de Propriedade', () => {

  describe('1. Unidade: Arredondamento HALF_UP e Centavos', () => {
    it('deve arredondar valores a partir de 0.005 para cima (HALF_UP comercial)', () => {
      expect(round2(1.005)).toBe(1.01);
      expect(round2(2.005)).toBe(2.01);
      expect(round2(10.005)).toBe(10.01);
      expect(round2(35.255)).toBe(35.26);
      expect(round2(0.005)).toBe(0.01);
    });

    it('deve arredondar valores abaixo de 0.005 para baixo', () => {
      expect(round2(1.004)).toBe(1.00);
      expect(round2(1.0049)).toBe(1.00);
      expect(round2(35.254)).toBe(35.25);
      expect(round2(0.004)).toBe(0.00);
    });

    it('deve arredondar valores negativos simetricamente afastando-se de zero (-HALF_UP)', () => {
      expect(round2(-1.005)).toBe(-1.01);
      expect(round2(-1.004)).toBe(-1.00);
      expect(round2(-35.255)).toBe(-35.26);
    });

    it('deve eliminar anomalias clássicas de float binário IEEE 754', () => {
      expect(0.1 + 0.2).not.toBe(0.3); // Prova da falha natural do float
      expect(round2(0.1 + 0.2)).toBe(0.3);
      expect(addMoney(0.1, 0.2)).toBe(0.3);
      expect(subtractMoney(0.3, 0.1)).toBe(0.2);
    });

    it('deve converter com fidelidade entre reais e centavos inteiros', () => {
      expect(toCents(1234.56)).toBe(123456);
      expect(fromCents(123456)).toBe(1234.56);
      expect(toCents(-99.90)).toBe(-9990);
      expect(fromCents(-9990)).toBe(-99.90);
      expect(toCents(0.01)).toBe(1);
      expect(fromCents(1)).toBe(0.01);
    });

    it('deve somar arrays de valores sem desvio acumulativo', () => {
      // 10 parcelas de 10 centavos
      const parcelas = Array(10).fill(0.1);
      expect(sumMoney(parcelas)).toBe(1.00);

      // Soma de dízimas arredondadas
      const itens = [10.25, 20.35, 30.40, 5.01];
      expect(sumMoney(itens)).toBe(66.01);
    });

    it('deve tratar divisão por zero e fatores com segurança', () => {
      expect(divideMoney(100, 0)).toBe(0);
      expect(divideMoney(100, 3)).toBe(33.33); // 100 / 3 = 33.3333... -> 33.33
      expect(multiplyMoney(100, 0.1555)).toBe(15.55); // 15.55
      expect(multiplyMoney(100, 0.15555)).toBe(15.56); // 15.555 -> 15.56
    });

    it('deve comparar igualdade monetária em centavos', () => {
      expect(moneyEquals(0.1 + 0.2, 0.3)).toBe(true);
      expect(moneyEquals(10.50, 10.50)).toBe(true);
      expect(moneyEquals(10.50, 10.51)).toBe(false);
    });
  });

  describe('2. Critério de Aceite Doc §4 (T21): Teste de Propriedade em 1.000 Casos', () => {
    it('propriedade: líquido = proventos − descontos exato em 1.000 casos aleatórios', () => {
      // Gerador pseudo-aleatório determinístico (LCG) para reprodutibilidade estrita
      let seed = 42;
      const pseudoRandom = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      for (let i = 1; i <= 1000; i++) {
        // Gerar entre 1 e 8 itens de proventos com centavos arbitrários
        const numProventos = 1 + Math.floor(pseudoRandom() * 8);
        const proventos: number[] = [];
        for (let p = 0; p < numProventos; p++) {
          // Valores de R$ 10,00 até R$ 8.500,00 com frações
          const valorBruto = 10 + pseudoRandom() * 8490;
          proventos.push(round2(valorBruto));
        }

        // Gerar entre 1 e 5 itens de descontos
        const numDescontos = 1 + Math.floor(pseudoRandom() * 5);
        const descontos: number[] = [];
        for (let d = 0; d < numDescontos; d++) {
          // Valores de R$ 5,00 até R$ 1.500,00 com frações
          const valorBruto = 5 + pseudoRandom() * 1495;
          descontos.push(round2(valorBruto));
        }

        const totalProventos = sumMoney(proventos);
        const totalDescontos = sumMoney(descontos);
        const liquido = subtractMoney(totalProventos, totalDescontos);

        // 1. Invariante: liquido deve ser exatamente igual a round2(totalProventos - totalDescontos)
        expect(liquido).toBe(round2(totalProventos - totalDescontos));

        // 2. Invariante em centavos: toCents(liquido) === toCents(totalProventos) - toCents(totalDescontos)
        expect(toCents(liquido)).toBe(toCents(totalProventos) - toCents(totalDescontos));

        // 3. Equação contábil fechada: liquido + totalDescontos === totalProventos
        expect(addMoney(liquido, totalDescontos)).toBe(totalProventos);
      }
    });
  });

  describe('3. Integração: PayrollEngine com precisão money.ts', () => {
    it('deve garantir invariante no cálculo completo de folha mensal', async () => {
      const context = new PayrollContext({
        salario_base: 4321.75,
        tipo_folha: 'MONTHLY',
        dias_trabalhados: 30,
        inss_parameters: [
          { step_order: 1, base_limit: 1518.00, aliquot: 7.5 },
          { step_order: 2, base_limit: 2793.88, aliquot: 9.0 },
          { step_order: 3, base_limit: 4190.83, aliquot: 12.0 },
          { step_order: 4, base_limit: 8157.41, aliquot: 14.0 }
        ],
        irrf_parameters: [
          { step_order: 1, base_limit: 2259.20, aliquot: 0, deduction_amount: 0 },
          { step_order: 2, base_limit: 2826.65, aliquot: 7.5, deduction_amount: 169.44 },
          { step_order: 3, base_limit: 3751.05, aliquot: 15.0, deduction_amount: 381.44 },
          { step_order: 4, base_limit: 4664.68, aliquot: 22.5, deduction_amount: 662.77 },
          { step_order: 5, base_limit: null, aliquot: 27.5, deduction_amount: 896.00 }
        ],
        general_legal_parameters: {
          minimum_wage: 1518.00,
          dependent_deduction: 189.59,
          simplified_discount: 607.20,
          irrf_reduction_a: 5000.00,
          irrf_reduction_b: 7350.00
        },
        rubricas: [
          {
            id: 'r1',
            code: '101',
            name: 'Salário Base',
            type: 'EARNING',
            calculation_form: 'FIXO',
            calculation_order: 1,
            is_active: true,
            incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
          },
          {
            id: 'r2',
            code: '150',
            name: 'Hora Extra 50%',
            type: 'EARNING',
            calculation_form: 'HORA_EXTRA',
            calculation_base: 'BASE_HORA_EXTRA',
            factor: 1.5,
            divisor: 220,
            calculation_order: 2,
            is_active: true,
            incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
          },
          {
            id: 'r3',
            code: '801',
            name: 'Faltas Injustificadas',
            type: 'DEDUCTION',
            calculation_form: 'DIAS',
            divisor: 30,
            calculation_order: 3,
            is_active: true,
            incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
          },
          {
            id: 'r4',
            code: '901',
            name: 'INSS',
            type: 'DEDUCTION',
            calculation_form: 'AUTOMATICA',
            calculation_order: 90,
            is_active: true,
            incidencias: {}
          },
          {
            id: 'r5',
            code: '902',
            name: 'IRRF',
            type: 'DEDUCTION',
            calculation_form: 'AUTOMATICA',
            calculation_order: 91,
            is_active: true,
            incidencias: {}
          },
          {
            id: 'r6',
            code: '903',
            name: 'FGTS',
            type: 'BASE',
            calculation_form: 'AUTOMATICA',
            calculation_order: 92,
            is_active: true,
            incidencias: {}
          }
        ],
        lancamentos_variaveis: [
          { rubric_id: 'r2', quantity: 12.5 }, // 12.5 horas extras
          { rubric_id: 'r3', quantity: 1 }     // 1 falta
        ]
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      expect(result.status).toBe('CALCULADA');

      // Invariante de precisão absoluta no resultado da folha
      expect(result.liquido).toBe(subtractMoney(result.total_proventos, result.total_descontos));
      expect(toCents(result.liquido)).toBe(toCents(result.total_proventos) - toCents(result.total_descontos));
      expect(addMoney(result.liquido, result.total_descontos)).toBe(result.total_proventos);
    });
  });
});
