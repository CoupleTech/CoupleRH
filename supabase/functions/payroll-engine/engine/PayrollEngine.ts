import { PayrollContext, CalculationResult } from './PayrollContext.ts';
import { DAGResolver } from '../rubrics/DAGResolver.ts';
import { RubricFormulaParser } from '../rubrics/RubricFormulaParser.ts';
import { INSSCalculator } from '../legal/INSSCalculator.ts';
import { IRRFCalculator } from '../legal/IRRFCalculator.ts';
import { FGTSCalculator } from '../legal/FGTSCalculator.ts';
import { round2, addMoney, subtractMoney } from '../utils/money.ts';

export class PayrollEngine {
  context: PayrollContext;

  constructor(context: PayrollContext) {
    this.context = context;
  }

  public async run(): Promise<CalculationResult> {
    try {
      // 1. Validar e ordenar rubricas (DAG)
      const sortedRubrics = DAGResolver.resolve(this.context.rubricas);

      // T14: Resolução de Não Cumulatividade entre Insalubridade e Periculosidade (CLT art. 193 §2º)
      let electedHazardKind: 'INSALUBRIDADE' | 'PERICULOSIDADE' | null = null;
      let nonElectedReason = '';

      if (!this.context.allow_cumulative_hazard_allowances) {
        const insalubridadeRubric = sortedRubrics.find(r => 
          (r.rubric_kind === 'INSALUBRIDADE' || r.code === '302' || (r.name || '').toUpperCase().includes('INSALUBRIDADE')) && r.type === 'EARNING'
        );
        const periculosidadeRubric = sortedRubrics.find(r => 
          (r.rubric_kind === 'PERICULOSIDADE' || r.code === '303' || (r.name || '').toUpperCase().includes('PERICULOSIDADE')) && r.type === 'EARNING'
        );

        if (insalubridadeRubric && periculosidadeRubric) {
          const evIns = this.context.eventos.find(e => e.rubric_id === insalubridadeRubric.id);
          const evPer = this.context.eventos.find(e => e.rubric_id === periculosidadeRubric.id);

          // A regra de não cumulatividade (CLT art. 193 §2º) só se aplica se o colaborador possuir ambos os adicionais no mês
          if (evIns && evPer) {
            // Insalubridade estimada
            let percIns = insalubridadeRubric.percentage || 20;
            if (evIns.value_type === 'PERCENT' || evIns.percentage !== undefined) {
              percIns = evIns.percentage ?? evIns.manual_value ?? percIns;
            } else if (evIns.manual_value !== undefined && evIns.manual_value <= 100) {
              percIns = evIns.manual_value;
            }
            const baseIns = this.context.salario_minimo || 1621.0;
            const valorIns = evIns.value_type === 'AMOUNT' ? (evIns.manual_value || 0) : round2(baseIns * (percIns / 100));

            // Periculosidade estimada
            let percPer = periculosidadeRubric.percentage || 30;
            if (evPer.value_type === 'PERCENT' || evPer.percentage !== undefined) {
              percPer = evPer.percentage ?? evPer.manual_value ?? percPer;
            } else if (evPer.manual_value !== undefined && evPer.manual_value <= 100) {
              percPer = evPer.manual_value;
            }
            const basePer = this.context.salario_base || 0;
            const valorPer = evPer.value_type === 'AMOUNT' ? (evPer.manual_value || 0) : round2(basePer * (percPer / 100));

            if (valorPer >= valorIns) {
              electedHazardKind = 'PERICULOSIDADE';
              nonElectedReason = `Insalubridade não cumulativa com Periculosidade (CLT art. 193 §2º). Aplicado o adicional mais vantajoso (Periculosidade: R$ ${valorPer.toFixed(2)} vs Insalubridade: R$ ${valorIns.toFixed(2)}).`;
            } else {
              electedHazardKind = 'INSALUBRIDADE';
              nonElectedReason = `Periculosidade não cumulativa com Insalubridade (CLT art. 193 §2º). Aplicado o adicional mais vantajoso (Insalubridade: R$ ${valorIns.toFixed(2)} vs Periculosidade: R$ ${valorPer.toFixed(2)}).`;
            }
          }
        }
      }

      // 2 & 3. Processar eventos manuais, automáticos e fórmulas em ordem DAG
      for (const rubric of sortedRubrics) {
        try {
          // Encontra eventos associados à rubrica, se existirem (MANUAIS)
        const eventos = this.context.eventos.filter(e => e.rubric_id === rubric.id);
        
        let valorCalculado = 0;
        let quantidade = rubric.quantity || 0;
        let formulaUsada = rubric.formula || '';
        let calcForm = rubric.calculation_form;
        let calcBaseName = rubric.calculation_base;
        let factor = rubric.factor;
        let percentage = rubric.percentage;
        let divisor = rubric.divisor;
        let hasManualValue = false;

        const kind = rubric.rubric_kind;

        let isSalaryBase: boolean;
        let isOvertime: boolean;
        let isDsr: boolean;
        let isDsrNoturno: boolean;
        let isAdicionalNoturno: boolean;
        let isInsalubridade: boolean;
        let isPericulosidade: boolean;
        let isAbsence: boolean;
        let isLate: boolean;
        let isCommission: boolean;

        if (kind) {
          // MOTOR ORIENTADO A DADOS (T22: kind explícito com tipagem estrita de type)
          isSalaryBase = kind === 'SALARY_BASE' && rubric.type === 'EARNING';
          isOvertime = kind === 'OVERTIME' && rubric.type === 'EARNING';
          isDsr = kind === 'DSR' && rubric.type === 'EARNING';
          isDsrNoturno = kind === 'DSR_NOTURNO' && rubric.type === 'EARNING';
          isAdicionalNoturno = kind === 'ADIC_NOTURNO' && rubric.type === 'EARNING';
          isInsalubridade = kind === 'INSALUBRIDADE' && rubric.type === 'EARNING';
          isPericulosidade = kind === 'PERICULOSIDADE' && rubric.type === 'EARNING';
          isAbsence = kind === 'ABSENCE' && rubric.type === 'DEDUCTION';
          isLate = kind === 'LATE' && rubric.type === 'DEDUCTION';
          isCommission = kind === 'COMMISSION' && rubric.type === 'EARNING';
        } else {
          // HEURÍSTICAS LEGADAS (Fallback temporário com console.warn conforme Doc §4 T22)
          console.warn(`[Rubrica ${rubric.code || 'S/C'} - ${rubric.name || 'Sem Nome'}] rubric_kind não definido; acionando heurística legada.`);

          isSalaryBase = (rubric.category === 'SALARY' || rubric.code === '101' || rubric.code === '1001' || (rubric.name || '').toLowerCase().includes('salário base') || (rubric.name || '').toLowerCase().includes('salario base')) && rubric.type === 'EARNING';
          isOvertime = (rubric.category === 'OVERTIME' || rubric.category === 'HORA_EXTRA' || (rubric.name || '').toUpperCase().includes('HORA EXTRA')) && rubric.type === 'EARNING';
          isDsrNoturno = (rubric.code === '171' || (rubric.name || '').toUpperCase().includes('NOTURNO DSR') || (rubric.name || '').toUpperCase().includes('DSR SOBRE ADICIONAL NOTURNO')) && rubric.type === 'EARNING';
          isDsr = (rubric.category === 'DSR' || rubric.code === '1011' || rubric.code === '170' || rubric.code === '104' || ((rubric.name || '').toUpperCase().includes('DSR') && !isDsrNoturno)) && rubric.type === 'EARNING';
          // Precedência corrigida: descarta DSR noturno e exige EARNING
          isAdicionalNoturno = (rubric.code === '301' || ((rubric.name || '').toUpperCase().includes('NOTURNO') && !isDsrNoturno)) && rubric.type === 'EARNING';
          isInsalubridade = (rubric.code === '302' || (rubric.name || '').toUpperCase().includes('INSALUBRIDADE')) && rubric.type === 'EARNING';
          isPericulosidade = (rubric.code === '303' || (rubric.name || '').toUpperCase().includes('PERICULOSIDADE')) && rubric.type === 'EARNING';
          isAbsence = (rubric.code === '801' || (rubric.name || '').toUpperCase().includes('FALTA')) && rubric.type === 'DEDUCTION';
          isLate = (rubric.code === '802' || rubric.code === '803' || (rubric.name || '').toUpperCase().includes('ATRASO')) && rubric.type === 'DEDUCTION';
          isCommission = (rubric.category === 'COMMISSION' || (rubric.name || '').toUpperCase().includes('COMISSAO') || (rubric.name || '').toUpperCase().includes('COMISSÃO')) && rubric.type === 'EARNING';
        }

        let isNonElectedHazard = false;
        // T14: Se houver não cumulatividade ativa para insalubridade ou periculosidade (CLT art. 193 §2º)
        if (isInsalubridade && electedHazardKind === 'PERICULOSIDADE') {
          valorCalculado = 0;
          formulaUsada = nonElectedReason;
          hasManualValue = true;
          isNonElectedHazard = true;
        } else if (isPericulosidade && electedHazardKind === 'INSALUBRIDADE') {
          valorCalculado = 0;
          formulaUsada = nonElectedReason;
          hasManualValue = true;
          isNonElectedHazard = true;
        }

        // Se tiver evento lançado para esta rubrica, pega a quantidade ou valor manual
        if (!isNonElectedHazard && eventos.length > 0) {
            quantidade = eventos.reduce((acc, ev) => acc + (ev.quantity || 0), 0) || quantidade;

            // T14: Se houver evento com valor percentual (value_type === 'PERCENT' ou percentage informado)
            const percentEvents = eventos.filter(ev => 
                ev.value_type === 'PERCENT' || 
                (ev.percentage !== undefined && ev.percentage !== null)
            );
            if (percentEvents.length > 0) {
                percentage = percentEvents[0].percentage ?? percentEvents[0].manual_value ?? percentage;
            }

            // Eventos com valor monetário em R$
            const amountEvents = eventos.filter(ev => {
                if (ev.value_type === 'PERCENT') return false;
                if (ev.value_type === 'AMOUNT') {
                    if (isSalaryBase && (!ev.manual_value || ev.manual_value === 0)) return false;
                    return ev.manual_value !== undefined && ev.manual_value !== null;
                }
                // Sem value_type definido: se rubric for percentual, não trata como AMOUNT se <= 100
                if (!ev.value_type && (calcForm === 'PERCENTUAL' || isInsalubridade || isPericulosidade)) {
                    if (ev.manual_value !== undefined && ev.manual_value !== null && ev.manual_value > 0 && ev.manual_value <= 100) {
                        percentage = ev.manual_value;
                        return false;
                    }
                }
                // Para salário base com manual_value 0 (inicialização de dias), não considerar override manual
                if (isSalaryBase && (!ev.manual_value || ev.manual_value === 0)) {
                    return false;
                }
                return ev.manual_value !== undefined && ev.manual_value !== null;
            });

            if (amountEvents.length > 0) {
                hasManualValue = true;
                valorCalculado = amountEvents.reduce((acc, ev) => acc + (ev.manual_value || 0), 0);
                formulaUsada = valorCalculado === 0 ? 'MANUAL_VALUE_ZERO' : 'MANUAL_VALUE';
            }
        }

        // Configuração inteligente de base/fatores para rubricas com cálculo automatizado
        if (isOvertime) {
            calcForm = 'HORAS';
            if (!calcBaseName) calcBaseName = 'SALARIO_BASE';
            if (!factor) factor = 1.5;
        } else if (isDsrNoturno) {
            calcForm = 'PERCENTUAL';
            if (!calcBaseName) calcBaseName = 'BASE_DSR_NOTURNO';
            if (!percentage) {
                if (this.context.dias_uteis > 0 && this.context.dias_inuteis > 0) {
                    percentage = (this.context.dias_inuteis / this.context.dias_uteis) * 100;
                } else {
                    percentage = 20; // 20% fallback (1/5)
                }
            }
        } else if (isDsr) {
            calcForm = 'PERCENTUAL';
            if (!calcBaseName) calcBaseName = 'BASE_DSR';
            if (!percentage) {
                if (this.context.dias_uteis > 0 && this.context.dias_inuteis > 0) {
                    percentage = (this.context.dias_inuteis / this.context.dias_uteis) * 100;
                } else {
                    percentage = 20; // 20% fallback (1/5)
                }
            }
        } else if (isInsalubridade) {
            calcForm = 'PERCENTUAL';
            if (!calcBaseName) calcBaseName = 'SALARIO_MINIMO';
            if (!percentage) percentage = 20; // 20% por padrão (grau médio)
        } else if (isPericulosidade) {
            calcForm = 'PERCENTUAL';
            if (!calcBaseName) calcBaseName = 'SALARIO_BASE';
            if (!percentage) percentage = 30; // 30% padrão
        } else if (isAdicionalNoturno) {
            calcForm = 'HORAS';
            if (!calcBaseName) calcBaseName = 'SALARIO_BASE';
            if (!factor) factor = 0.20; // 20%
        } else if (rubric.code === '502' || rubric.code === '504') {
            calcForm = 'PERCENTUAL';
            if (!calcBaseName) calcBaseName = rubric.code === '502' ? 'R501' : 'R503';
            if (!percentage) percentage = 33.3333; // 1/3
        } else if (isAbsence || rubric.code === '801' || rubric.code === '210') {
            calcForm = 'DIAS';
            if (!calcBaseName) calcBaseName = 'SALARIO_BASE';
        } else if (isLate || rubric.code === '802' || rubric.code === '211') {
            calcForm = 'HORAS';
            if (!calcBaseName) calcBaseName = 'SALARIO_BASE';
            if (!factor) factor = 1.0;
        }
        
        // Se o valorCalculado ainda não foi definido manualmente, calcula!
        if (!hasManualValue) {
            if (calcForm === 'FORMULA' && rubric.formula) {
                const knownCodes = new Set(Array.from(this.context.rubricas.values()).map(r => r.code));
                const currentParser = new RubricFormulaParser(this.context.variables, knownCodes);
                valorCalculado = currentParser.evaluate(rubric.formula);
            }
            else if ((calcForm === 'HORAS' || calcForm === 'HOURS') && calcBaseName) {
                if (quantidade > 0) {
                    const baseVal = this.context.getVariable(calcBaseName);
                    const effFactor = factor || 1.5;
                    const effDivisor = divisor || this.context.getVariable('DIVISOR') || 220;
                    const valorHora = baseVal / effDivisor;
                    valorCalculado = (valorHora * effFactor) * quantidade;
                    formulaUsada = `(${baseVal} / ${effDivisor}) * ${effFactor} * ${quantidade}`;
                } else {
                    valorCalculado = 0;
                    formulaUsada = `HORAS_ZERADAS`;
                }
            }
            else if (calcForm === 'PERCENTUAL' || calcForm === 'PERCENTAGE' || calcForm === 'PERCENTAGE_OF_BASE') {
                if (calcBaseName) {
                    const baseVal = this.context.getVariable(calcBaseName);
                    let perc = percentage;
                    
                    if (!perc && (isDsr || isDsrNoturno)) {
                        if (this.context.dias_uteis > 0 && this.context.dias_inuteis > 0) {
                            perc = (this.context.dias_inuteis / this.context.dias_uteis) * 100;
                        } else {
                            perc = 20;
                        }
                    }
                    
                    perc = perc || 0;
                    percentage = perc;
                    
                    if (quantidade > 0) {
                        valorCalculado = baseVal * (perc / 100) * quantidade;
                        formulaUsada = `PERCENTUAL(${calcBaseName} * ${perc}% * ${quantidade})`;
                    } else if (isDsr || isDsrNoturno) {
                        if (baseVal > 0) {
                            valorCalculado = baseVal * (perc / 100);
                            formulaUsada = `PERCENTUAL(${calcBaseName} * ${perc}%)`;
                            quantidade = 1;
                        }
                    }
                }
            }
            else if (calcForm === 'AVOS' && calcBaseName) {
                const baseVal = this.context.getVariable(calcBaseName);
                const effDivisor = divisor || 12;
                valorCalculado = (baseVal / effDivisor) * quantidade;
                formulaUsada = `AVOS(${calcBaseName} / ${effDivisor} * ${quantidade})`;
            }
            else if ((calcForm === 'DIAS' || calcForm === 'DAYS') && calcBaseName) {
                const baseVal = this.context.getVariable(calcBaseName);
                const perc = percentage || 100;
                valorCalculado = (baseVal / 30) * quantidade * (perc / 100);
                formulaUsada = `DIAS(${calcBaseName} / 30 * ${quantidade})`;
            }
            else if (calcForm === 'FIXO' || calcForm === 'FIXED') {
                const effectiveBase = calcBaseName || (isSalaryBase ? 'SALARIO_BASE' : null);
                
                if (effectiveBase && isSalaryBase) {
                  const val = this.context.getVariable(effectiveBase);
                  // Proporcionaliza o salário base se admissão/rescisão ocorreu no mês (T22: orientado a kind)
                  if (this.context.dias_trabalhados < 30) {
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

        valorCalculado = round2(valorCalculado);

        if (valorCalculado !== 0) {
            // Adiciona memória
            this.context.addMemory({
                rubric_id: rubric.id,
                step_name: rubric.name,
                base_value: calcBaseName && this.context.hasVariable(calcBaseName) ? this.context.getVariable(calcBaseName) : 0,
                quantity_used: quantidade,
                percentage_used: percentage || 0,
                parsed_formula: formulaUsada,
                result_value: valorCalculado,
                origin: rubric.calculation_form
            });

            // Atualiza totais
            if (rubric.type === 'EARNING') {
                this.context.total_proventos = addMoney(this.context.total_proventos, valorCalculado);
            } else if (rubric.type === 'DEDUCTION') {
                this.context.total_descontos = addMoney(this.context.total_descontos, valorCalculado);
            }

            // BUG 3 fix: Atualiza Bases Legais — Descontos SUBTRAEM das bases
            if (rubric.incidencias.gera_base_inss) {
              this.context.base_inss = round2(this.context.base_inss + (rubric.type === 'DEDUCTION' ? -valorCalculado : valorCalculado));
            }
            if (rubric.incidencias.gera_base_irrf) {
              this.context.base_irrf = round2(this.context.base_irrf + (rubric.type === 'EARNING' ? valorCalculado : -valorCalculado));
            }
            if (rubric.incidencias.gera_base_fgts) {
              this.context.base_fgts = round2(this.context.base_fgts + (rubric.type === 'DEDUCTION' ? -valorCalculado : valorCalculado));
            }

            // Acumula bases dinâmicas
            if (isOvertime || isCommission) {
                const currentBaseDSR = this.context.getVariable('BASE_DSR') || 0;
                this.context.setVariable('BASE_DSR', round2(currentBaseDSR + valorCalculado));
            }
            if (isAdicionalNoturno) {
                const currentBaseDSRNoturno = this.context.getVariable('BASE_DSR_NOTURNO') || 0;
                this.context.setVariable('BASE_DSR_NOTURNO', round2(currentBaseDSRNoturno + valorCalculado));
            }

        } else if (hasManualValue) {
            // Registro explícito na memória de cálculo quando um evento manual for lançado com valor 0
            this.context.addMemory({
                rubric_id: rubric.id,
                step_name: rubric.name,
                base_value: calcBaseName && this.context.hasVariable(calcBaseName) ? this.context.getVariable(calcBaseName) : 0,
                quantity_used: quantidade,
                percentage_used: percentage || 0,
                parsed_formula: formulaUsada,
                result_value: 0,
                origin: rubric.calculation_form
            });
        }

          // T24: Atualiza a variável com o código da rubrica (sempre com prefixo R{code})
          // Não salvar rubric.code puro para não colidir com constantes numéricas (ex: 220, 30)
          if (rubric.code) {
            this.context.setVariable(`R${rubric.code}`, valorCalculado);
          }
        } catch (err: any) {
          throw new Error(`[Rubrica ${rubric.code || 'S/C'} - ${rubric.name || 'Sem Nome'}] ${err.message}`);
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
        // T1: Guarda base bruta de IRRF ANTES de processar o INSS
        const baseIrrfBruta = this.context.base_irrf;

        // INSS (T16: Consolidado com base já tributada em outras folhas da mesma competência)
        inssResult = INSSCalculator.calculate(
          this.context.base_inss, 
          this.context.inss_parameters,
          this.context.base_inss_already_taxed
        );

        if (inssResult.value > 0 || this.context.base_inss_already_taxed > 0) {
           if (inssResult.value > 0) {
             this.context.total_descontos = addMoney(this.context.total_descontos, inssResult.value);
           }
           
           // T6: Busca rubrica INSS exclusivamente por código '901' (Doc §4)
           const rubricInss = Array.from(this.context.rubricas.values()).find(r => r.code === '901');
           if (!rubricInss) {
             throw new Error("Rubrica de sistema obrigatória ausente no catálogo: [901 - Contribuição INSS]");
           }

           const formulaDesc = this.context.base_inss_already_taxed > 0
             ? `INSS_CONSOLIDADO(Base Atual: R$ ${this.context.base_inss.toFixed(2)}, Base Já Tributada: R$ ${this.context.base_inss_already_taxed.toFixed(2)}, INSS Devido: R$ ${inssResult.value.toFixed(2)})`
             : JSON.stringify(inssResult.breakdown);

           this.context.addMemory({
              rubric_id: rubricInss.id,
              step_name: 'INSS',
              base_value: this.context.base_inss,
              quantity_used: 1,
              percentage_used: 0,
              parsed_formula: formulaDesc,
              result_value: inssResult.value,
              origin: 'AUTOMATICA'
           });
        }

        // IRRF: Base bruta, INSS real, dependentes e parâmetros legais (T1/Doc §4)
        const dependentes = this.context.getVariable('DEPENDENTES') || 0;
        irrfResult = IRRFCalculator.calculate(baseIrrfBruta, inssResult.value, dependentes, this.context.irrf_parameters, this.context.general_legal_parameters); 
        
        if (irrfResult.value > 0) {
           this.context.total_descontos = addMoney(this.context.total_descontos, irrfResult.value);
        }

        // T6: Busca rubrica IRRF exclusivamente por código '902' (Doc §4)
        const rubricIrrf = Array.from(this.context.rubricas.values()).find(r => r.code === '902');
        if (irrfResult.value > 0 && !rubricIrrf) {
           throw new Error("Rubrica de sistema obrigatória ausente no catálogo: [902 - IRRF Mensal]");
        }

        if (rubricIrrf && (baseIrrfBruta > 0 || irrfResult.value > 0)) {
           this.context.addMemory({
              rubric_id: rubricIrrf.id,
              step_name: 'IRRF',
              base_value: irrfResult.legalBase,
              quantity_used: 1,
              percentage_used: 0,
              parsed_formula: `${irrfResult.usedSimplified ? 'Simplificada' : 'Deduções Legais'} (Bruto: ${baseIrrfBruta}, Redutor: ${irrfResult.reductionAmount ?? 0})`,
              result_value: irrfResult.value,
              origin: 'AUTOMATICA'
           });
        }

        // FGTS
        fgtsResult = FGTSCalculator.calculate(this.context.base_fgts);
        if (fgtsResult.value > 0) {
            // T6: Busca rubrica FGTS exclusivamente por código '903' (Doc §4)
            const rubricFgts = Array.from(this.context.rubricas.values()).find(r => r.code === '903');
            if (!rubricFgts) {
              throw new Error("Rubrica de sistema obrigatória ausente no catálogo: [903 - FGTS Mensal]");
            }
            
            this.context.addMemory({
              rubric_id: rubricFgts.id,
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
      const liquido = subtractMoney(this.context.total_proventos, this.context.total_descontos);
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
        total_proventos: round2(this.context.total_proventos),
        total_descontos: round2(this.context.total_descontos),
        total_inss: inssResult.value,
        total_irrf: irrfResult.value,
        total_fgts: fgtsResult.value,
        total_encargos_patronais: 0, // Outro escopo
        liquido: liquido,
        bases: {
          inss: round2(this.context.base_inss),
          irrf: round2(irrfResult.legalBase),
          fgts: round2(this.context.base_fgts)
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
