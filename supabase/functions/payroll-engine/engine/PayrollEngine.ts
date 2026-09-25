import { PayrollContext, CalculationResult } from './PayrollContext.ts';
import { DAGResolver } from '../rubrics/DAGResolver.ts';
import { RubricFormulaParser } from '../rubrics/RubricFormulaParser.ts';
import { INSSCalculator } from '../legal/INSSCalculator.ts';
import { IRRFCalculator } from '../legal/IRRFCalculator.ts';
import { FGTSCalculator } from '../legal/FGTSCalculator.ts';

export class PayrollEngine {
  context: PayrollContext;

  constructor(context: PayrollContext) {
    this.context = context;
  }

  public async run(): Promise<CalculationResult> {
    try {
      // 1. Validar e ordenar rubricas (DAG)
      const sortedRubrics = DAGResolver.resolve(this.context.rubricas);

      // 2 & 3. Processar eventos manuais, automáticos e fórmulas em ordem DAG
      for (const rubric of sortedRubrics) {
        // Encontra eventos associados à rubrica, se existirem (MANUAIS)
        const eventos = this.context.eventos.filter(e => e.rubric_id === rubric.id);
        
        let valorCalculado = 0;
        let quantidade = rubric.quantity || 0;
        let formulaUsada = rubric.formula || '';
        let calcForm = rubric.calculation_form;

        // Se tiver evento variável lançado para esta rubrica, pega a quantidade ou valor manual
        if (eventos.length > 0) {
            quantidade = eventos.reduce((acc, ev) => acc + (ev.quantity || 0), 0) || quantidade;
            const eventManualValue = eventos.reduce((acc, ev) => acc + (ev.manual_value || 0), 0);
            if (eventManualValue > 0) {
                valorCalculado = eventManualValue;
                formulaUsada = 'MANUAL_VALUE';
            }
        } 

        const isOvertime = rubric.category === 'OVERTIME' || rubric.category === 'HORA_EXTRA' || (rubric.name || '').toUpperCase().includes('HORA EXTRA');
        const isDsrNoturno = rubric.code === '171' || (rubric.name || '').toUpperCase().includes('NOTURNO DSR') || (rubric.name || '').toUpperCase().includes('DSR SOBRE ADICIONAL NOTURNO');
        const isDsr = rubric.category === 'DSR' || rubric.code === '1011' || rubric.code === '170' || rubric.code === '104' || ((rubric.name || '').toUpperCase().includes('DSR') && !isDsrNoturno);
        const isAdicionalNoturno = rubric.code === '301' || (rubric.name || '').toUpperCase().includes('NOTURNO') && !isDsrNoturno;
        const isInsalubridade = rubric.code === '302' || (rubric.name || '').toUpperCase().includes('INSALUBRIDADE');
        const isPericulosidade = rubric.code === '303' || (rubric.name || '').toUpperCase().includes('PERICULOSIDADE');

        // Override inteligente para garantir que rubricas do sistema calculem corretamente independente de como foram cadastradas na UI
        if (isOvertime) {
            calcForm = 'HORAS';
            if (!rubric.calculation_base) rubric.calculation_base = 'SALARIO_BASE';
            if (!rubric.factor) rubric.factor = 1.5;
        } else if (isDsrNoturno) {
            calcForm = 'PERCENTUAL';
            if (!rubric.calculation_base) rubric.calculation_base = 'BASE_DSR_NOTURNO';
            if (!rubric.percentage) {
                if (this.context.dias_uteis > 0 && this.context.dias_inuteis > 0) {
                    rubric.percentage = (this.context.dias_inuteis / this.context.dias_uteis) * 100;
                } else {
                    rubric.percentage = 20; // 20% fallback (1/5)
                }
            }
        } else if (isDsr) {
            calcForm = 'PERCENTUAL';
            if (!rubric.calculation_base) rubric.calculation_base = 'BASE_DSR';
            if (!rubric.percentage) {
                if (this.context.dias_uteis > 0 && this.context.dias_inuteis > 0) {
                    rubric.percentage = (this.context.dias_inuteis / this.context.dias_uteis) * 100;
                } else {
                    rubric.percentage = 20; // 20% fallback (1/5)
                }
            }
        } else if (isInsalubridade) {
            calcForm = 'PERCENTUAL';
            if (!rubric.calculation_base) rubric.calculation_base = 'SALARIO_MINIMO';
            if (!rubric.percentage) rubric.percentage = 20; // 20% por padrão (grau médio)
        } else if (isPericulosidade) {
            calcForm = 'PERCENTUAL';
            if (!rubric.calculation_base) rubric.calculation_base = 'SALARIO_BASE';
            if (!rubric.percentage) rubric.percentage = 30; // 30% padrão
        } else if (isAdicionalNoturno) {
            calcForm = 'HORAS';
            if (!rubric.calculation_base) rubric.calculation_base = 'SALARIO_BASE';
            if (!rubric.factor) rubric.factor = 0.20; // 20%
        } else if (rubric.code === '502' || rubric.code === '504') {
            calcForm = 'PERCENTUAL';
            if (!rubric.calculation_base) rubric.calculation_base = rubric.code === '502' ? 'R501' : 'R503';
            if (!rubric.percentage) rubric.percentage = 33.3333; // 1/3
        } else if (rubric.code === '801' || rubric.code === '210') {
            calcForm = 'DIAS';
            if (!rubric.calculation_base) rubric.calculation_base = 'SALARIO_BASE';
        } else if (rubric.code === '802' || rubric.code === '211') {
            calcForm = 'HORAS';
            if (!rubric.calculation_base) rubric.calculation_base = 'SALARIO_BASE';
            if (!rubric.factor) rubric.factor = 1.0;
        }
        
        // Se o valorCalculado ainda for 0 (ou seja, não tinha valor manual explícito, apenas a quantidade foi injetada), calcula!
        if (valorCalculado === 0) {
            if (calcForm === 'FORMULA' && rubric.formula) {
                const currentParser = new RubricFormulaParser(this.context.variables);
                valorCalculado = currentParser.evaluate(rubric.formula);
            }
            else if ((calcForm === 'HORAS' || calcForm === 'HOURS') && rubric.calculation_base) {
                if (quantidade > 0) {
                    const baseVal = this.context.getVariable(rubric.calculation_base);
                    const factor = rubric.factor || 1.5;
                    const divisor = rubric.divisor || this.context.getVariable('DIVISOR') || 220;
                    const valorHora = baseVal / divisor;
                    valorCalculado = (valorHora * factor) * quantidade;
                    formulaUsada = `(${baseVal} / ${divisor}) * ${factor} * ${quantidade}`;
                } else {
                    valorCalculado = 0;
                    formulaUsada = `HORAS_ZERADAS`;
                }
            }
            else if (calcForm === 'PERCENTUAL' || calcForm === 'PERCENTAGE' || calcForm === 'PERCENTAGE_OF_BASE') {
                if (rubric.calculation_base) {
                    const baseVal = this.context.getVariable(rubric.calculation_base);
                    let perc = rubric.percentage;
                    
                    if (!perc && (isDsr || isDsrNoturno)) {
                        if (this.context.dias_uteis > 0 && this.context.dias_inuteis > 0) {
                            perc = (this.context.dias_inuteis / this.context.dias_uteis) * 100;
                        } else {
                            perc = 20;
                        }
                        rubric.percentage = perc;
                    }
                    
                    perc = perc || 0;
                    
                    if (quantidade > 0) {
                        valorCalculado = baseVal * (perc / 100) * quantidade;
                        formulaUsada = `PERCENTUAL(${rubric.calculation_base} * ${perc}% * ${quantidade})`;
                    } else if (isDsr || isDsrNoturno) {
                        if (baseVal > 0) {
                            valorCalculado = baseVal * (perc / 100);
                            formulaUsada = `PERCENTUAL(${rubric.calculation_base} * ${perc}%)`;
                            quantidade = 1;
                        }
                    }
                }
            }
            else if (calcForm === 'AVOS' && rubric.calculation_base) {
                const baseVal = this.context.getVariable(rubric.calculation_base);
                const divisor = rubric.divisor || 12;
                valorCalculado = (baseVal / divisor) * quantidade;
                formulaUsada = `AVOS(${rubric.calculation_base} / ${divisor} * ${quantidade})`;
            }
            else if ((calcForm === 'DIAS' || calcForm === 'DAYS') && rubric.calculation_base) {
                const baseVal = this.context.getVariable(rubric.calculation_base);
                const perc = rubric.percentage || 100;
                valorCalculado = (baseVal / 30) * quantidade * (perc / 100);
                formulaUsada = `DIAS(${rubric.calculation_base} / 30 * ${quantidade})`;
            }
            else if (calcForm === 'FIXO' || calcForm === 'FIXED') {
                const isBaseSalary = rubric.code === '1001' || rubric.code === '101' || (rubric.name || '').toLowerCase().includes('salário base') || (rubric.name || '').toLowerCase().includes('salario base');
                const effectiveBase = rubric.calculation_base || (isBaseSalary ? 'SALARIO_BASE' : null);
                
                if (effectiveBase && isBaseSalary) {
                  const val = this.context.getVariable(effectiveBase);
                  // Proporcionaliza o salário base se admissão/rescisão ocorreu no mês
                  if (rubric.category === 'SALARY' && this.context.dias_trabalhados < 30) {
                      valorCalculado = (val / 30) * this.context.dias_trabalhados;
                  } else {
                      valorCalculado = val;
                  }
                  formulaUsada = `FIXO(${effectiveBase})`;
                } else if (rubric.manual_value || quantidade > 0) {
                  // Se não tem base mas tem um valor/quantidade passada, usa como fallback de valor fixo
                  valorCalculado = rubric.manual_value || quantidade;
                } else {
                  // Evita pagar a base integral se a quantidade e valor são zerados
                  valorCalculado = 0;
                  formulaUsada = 'SEM_VALOR_MANUAL';
                }
            }
        }

        valorCalculado = Math.round(valorCalculado * 100) / 100;

        if (valorCalculado > 0) {
            // Adiciona memória
            this.context.addMemory({
                rubric_id: rubric.id,
                step_name: rubric.name,
                base_value: rubric.calculation_base ? this.context.getVariable(rubric.calculation_base) : 0,
                quantity_used: quantidade,
                percentage_used: rubric.percentage || 0,
                parsed_formula: formulaUsada,
                result_value: valorCalculado,
                origin: rubric.calculation_form
            });

            // Atualiza totais
            if (rubric.type === 'EARNING') {
                this.context.total_proventos += valorCalculado;
            } else if (rubric.type === 'DEDUCTION') {
                this.context.total_descontos += valorCalculado;
            }

            // BUG 3 fix: Atualiza Bases Legais — Descontos SUBTRAEM das bases
            if (rubric.incidencias.gera_base_inss) {
              this.context.base_inss += (rubric.type === 'DEDUCTION' ? -valorCalculado : valorCalculado);
            }
            if (rubric.incidencias.gera_base_irrf) {
              this.context.base_irrf += (rubric.type === 'EARNING' ? valorCalculado : -valorCalculado);
            }
            if (rubric.incidencias.gera_base_fgts) {
              this.context.base_fgts += (rubric.type === 'DEDUCTION' ? -valorCalculado : valorCalculado);
            }

            // Acumula bases dinâmicas
            if (isOvertime || rubric.category === 'COMMISSION') {
                const currentBaseDSR = this.context.getVariable('BASE_DSR') || 0;
                this.context.setVariable('BASE_DSR', currentBaseDSR + valorCalculado);
            }
            if (isAdicionalNoturno) {
                const currentBaseDSRNoturno = this.context.getVariable('BASE_DSR_NOTURNO') || 0;
                this.context.setVariable('BASE_DSR_NOTURNO', currentBaseDSRNoturno + valorCalculado);
            }

            // Atualiza a variável com o código da rubrica para poder ser usada por outras
            this.context.setVariable(`R${rubric.code}`, valorCalculado);
            // Também salva o código sem prefixo para retrocompatibilidade
            this.context.setVariable(rubric.code, valorCalculado);
        }
      }

      // 4. Cálculos Legais
      let inssResult = { value: 0, breakdown: [] };
      let irrfResult = { value: 0, legalBase: 0, usedSimplified: false };
      let fgtsResult = { value: 0 };
      
      // Valida Incidências Baseadas no Contrato (Pró-Labore, Estágio, CLT)
      if (this.context.contract_incidences) {
          if (this.context.contract_incidences.has_inss === false) this.context.base_inss = 0;
          if (this.context.contract_incidences.has_fgts === false) this.context.base_fgts = 0;
      }

      if (this.context.tipo_folha !== 'ADVANCE') {
        // INSS
        inssResult = INSSCalculator.calculate(this.context.base_inss, this.context.inss_parameters);
        if (inssResult.value > 0) {
           this.context.total_descontos += inssResult.value;
           this.context.base_irrf -= inssResult.value; // INSS deduz IRRF
           
           // BUG 7 fix: Busca rubrica INSS por código '901' primeiro, depois por nome
           const rubricInss = Array.from(this.context.rubricas.values()).find(r => r.code === '901' || r.code === '2001' || r.code === 'INSS_AUTO' || (r.name && r.name.toUpperCase().includes('INSS')));

           this.context.addMemory({
              rubric_id: rubricInss ? rubricInss.id : 'INSS_AUTO',
              step_name: 'INSS',
              base_value: this.context.base_inss,
              quantity_used: 1,
              percentage_used: 0,
              parsed_formula: JSON.stringify(inssResult.breakdown),
              result_value: inssResult.value,
              origin: 'AUTOMATICA'
           });
        }

        // IRRF
        const dependentes = this.context.getVariable('DEPENDENTES') || 0;
        irrfResult = IRRFCalculator.calculate(this.context.base_irrf, 0, dependentes, this.context.irrf_parameters, this.context.general_legal_parameters); 
        if (irrfResult.value > 0) {
           this.context.total_descontos += irrfResult.value;
           
            // BUG 7 fix: Busca rubrica IRRF por código '902' primeiro, depois por nome
           const rubricIrrf = Array.from(this.context.rubricas.values()).find(r => r.code === '902' || r.code === '2002' || r.code === 'IRRF_AUTO' || (r.name && (r.name.toUpperCase().includes('IRRF') || r.name.toUpperCase().includes('IRPF'))));

           this.context.addMemory({
              rubric_id: rubricIrrf ? rubricIrrf.id : 'IRRF_AUTO',
              step_name: 'IRRF',
              base_value: irrfResult.legalBase,
              quantity_used: 1,
              percentage_used: 0,
              parsed_formula: irrfResult.usedSimplified ? 'Simplificada' : 'Deduções Legais',
              result_value: irrfResult.value,
              origin: 'AUTOMATICA'
           });
        }

        // FGTS
        fgtsResult = FGTSCalculator.calculate(this.context.base_fgts);
        if (fgtsResult.value > 0) {
            // BUG 7 fix: Busca rubrica FGTS por código '903' primeiro, depois por nome
            const rubricFgts = Array.from(this.context.rubricas.values()).find(r => r.code === '903' || r.code === '2005' || r.code === 'FGTS_AUTO' || (r.name && r.name.toUpperCase().includes('FGTS')));
            
            this.context.addMemory({
              rubric_id: rubricFgts ? rubricFgts.id : 'FGTS_AUTO',
              step_name: 'FGTS',
              base_value: this.context.base_fgts,
              quantity_used: 1,
              percentage_used: 8,
              parsed_formula: `${this.context.base_fgts} * 0.08`,
              result_value: fgtsResult.value,
              origin: 'AUTOMATICA'
           });
        }
      }

      // BUG 11 fix: Alerta sobre líquido negativo na memória (não impede cálculo mas registra)
      const liquido = Math.round((this.context.total_proventos - this.context.total_descontos) * 100) / 100;
      if (liquido < 0) {
        this.context.addMemory({
          rubric_id: 'VALIDACAO',
          step_name: 'ALERTA: Líquido Negativo',
          base_value: this.context.total_proventos,
          quantity_used: 0,
          percentage_used: 0,
          parsed_formula: `Proventos ${this.context.total_proventos} - Descontos ${this.context.total_descontos} = ${liquido}`,
          result_value: liquido,
          origin: 'VALIDACAO'
        });
      }

      return {
        total_proventos: Math.round(this.context.total_proventos * 100) / 100,
        total_descontos: Math.round(this.context.total_descontos * 100) / 100,
        total_inss: inssResult.value,
        total_irrf: irrfResult.value,
        total_fgts: fgtsResult.value,
        total_encargos_patronais: 0, // Outro escopo
        liquido: liquido,
        bases: {
          inss: Math.round(this.context.base_inss * 100) / 100,
          irrf: Math.round(this.context.base_irrf * 100) / 100,
          fgts: Math.round(this.context.base_fgts * 100) / 100
        },
        memoria_calculo: this.context.memoria,
        status: liquido < 0 ? 'ALERTA_LIQUIDO_NEGATIVO' : 'CALCULADA'
      };

    } catch (e: any) {
       return {
          total_proventos: 0, total_descontos: 0, total_inss: 0, total_irrf: 0, total_fgts: 0, total_encargos_patronais: 0, liquido: 0,
          bases: { inss: 0, irrf: 0, fgts: 0 },
          memoria_calculo: [],
          status: `ERRO_CALCULO: ${e.message}`
       };
    }
  }
}
