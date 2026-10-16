import { round2, sumMoney, subtractMoney } from './money';
import { numberToWordsPtBr } from './numberToWordsPtBr';

export const calculateVacationReceipt = (
  baseSalary: number,
  daysTaken: number,
  cashAllowanceDays: number,
  startDateRaw: string,
  dependents: number = 0
) => {
  const startDate = new Date(startDateRaw);
  const startMonth = startDate.getMonth();
  const startYear = startDate.getFullYear();
  
  const endDate = new Date(startDate.getTime());
  endDate.setDate(endDate.getDate() + daysTaken - 1);
  
  let m1Days = 0;
  let m2Days = 0;
  
  if (startDate.getMonth() === endDate.getMonth()) {
    m1Days = daysTaken;
  } else {
    const lastDayOfStartMonth = new Date(startYear, startMonth + 1, 0).getDate();
    m1Days = lastDayOfStartMonth - startDate.getDate() + 1;
    m2Days = daysTaken - m1Days;
  }

  // 1. Proventos divididos
  const m1Ferias = round2((baseSalary / 30) * m1Days);
  const m1Ferias13 = round2(m1Ferias / 3);

  const m2Ferias = m2Days > 0 ? round2((baseSalary / 30) * m2Days) : 0;
  const m2Ferias13 = m2Days > 0 ? round2(m2Ferias / 3) : 0;
  
  const abono = round2((baseSalary / 30) * cashAllowanceDays);
  const abono13 = round2(abono / 3);

  const totalProventos = sumMoney([m1Ferias, m1Ferias13, m2Ferias, m2Ferias13, abono, abono13]);
  
  // 2. Descontos - INSS (separado por competência)
  const calcINSS = (base: number) => {
    let inss = 0;
    const inssBrackets = [
      { limit: 1621.00, rate: 7.5 },
      { limit: 2902.84, rate: 9.0 },
      { limit: 4354.27, rate: 12.0 },
      { limit: 8475.55, rate: 14.0 }
    ];
    let calcBase = Math.min(base, 8475.55);
    let currentBase = 0;
    for (const b of inssBrackets) {
      if (calcBase > currentBase) {
        const taxable = Math.min(calcBase, b.limit) - currentBase;
        inss += taxable * (b.rate / 100);
      }
      currentBase = b.limit;
    }
    return round2(inss);
  };

  const m1Inss = calcINSS(m1Ferias + m1Ferias13);
  const m2Inss = m2Days > 0 ? calcINSS(m2Ferias + m2Ferias13) : 0;
  const totalInss = m1Inss + m2Inss;

  // 3. Descontos - IRRF (Regime de Caixa = base total)
  const baseTributavelIR = (m1Ferias + m1Ferias13 + m2Ferias + m2Ferias13) - totalInss - (dependents * 189.59);
  const baseSimplificada = (m1Ferias + m1Ferias13 + m2Ferias + m2Ferias13) - 607.20;
  
  const calcBaseIRRF = Math.max(0, Math.min(baseTributavelIR, baseSimplificada));
  let irrf = 0;
  
  const irrfBrackets = [
    { limit: 2428.80, rate: 0, ded: 0 },
    { limit: 2826.65, rate: 7.5, ded: 182.16 },
    { limit: 3751.05, rate: 15.0, ded: 394.16 },
    { limit: 4664.68, rate: 22.5, ded: 675.49 },
    { limit: 99999999, rate: 27.5, ded: 908.73 }
  ];

  for (const b of irrfBrackets) {
    if (calcBaseIRRF <= b.limit) {
      irrf = (calcBaseIRRF * (b.rate / 100)) - b.ded;
      break;
    }
  }
  irrf = Math.max(0, irrf);
  
  // Redutor fase 2026
  const totalBase = m1Ferias + m1Ferias13 + m2Ferias + m2Ferias13;
  if (totalBase <= 5000) {
    irrf = Math.max(0, irrf - 312.89);
  } else if (totalBase <= 7350) {
    const redutor = 978.62 - (0.133145 * totalBase);
    irrf = Math.max(0, irrf - Math.max(0, redutor));
  }
  irrf = round2(irrf);

  const totalDescontos = sumMoney([totalInss, irrf]);
  const liquido = subtractMoney(totalProventos, totalDescontos);
  
  const getMonthStr = (d: Date) => {
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${months[d.getMonth()]}/${d.getFullYear()}`;
  }

  return {
    m1Days, m2Days,
    m1Ferias, m1Ferias13, m1Inss,
    m2Ferias, m2Ferias13, m2Inss,
    abono, abono13, irrf, totalProventos, totalDescontos, liquido,
    m1Str: getMonthStr(startDate),
    m2Str: getMonthStr(endDate)
  };
};

const commonStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #0f172a;
    background: #f8fafc;
    padding: 12px;
    font-size: 13px;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
  }
  .doc-container {
    max-width: 820px;
    margin: 0 auto;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .header-card {
    background: #0f172a;
    color: #ffffff;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .header-title {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .header-sub {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 500;
  }
  .card-section {
    border: 1px solid #e2e8f0;
    background: #ffffff;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 12px;
  }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #475569;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #f1f5f9;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 16px;
  }
  .grid-3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px 16px;
  }
  .data-item {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .data-lbl {
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 1px;
  }
  .data-val {
    font-size: 12.5px;
    font-weight: 600;
    color: #0f172a;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .data-val.nowrap {
    white-space: nowrap;
  }
  .table-wrapper {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    margin-bottom: 12px;
  }
  table.formal-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    min-width: 520px;
  }
  table.formal-table th {
    background: #f1f5f9;
    color: #334155;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 8px 10px;
    border-bottom: 1px solid #cbd5e1;
    text-align: left;
  }
  table.formal-table th.num, table.formal-table td.num {
    text-align: right;
    white-space: nowrap;
  }
  table.formal-table td {
    padding: 7px 10px;
    border-bottom: 1px solid #e2e8f0;
    color: #1e293b;
  }
  table.formal-table tr:last-child td {
    border-bottom: none;
  }
  table.formal-table tr.total-row td {
    background: #f8fafc;
    font-weight: 700;
    border-top: 1px solid #cbd5e1;
    color: #0f172a;
  }
  table.formal-table tr.net-row td {
    background: #ecfdf5;
    font-weight: 800;
    font-size: 13px;
    color: #065f46;
    border-top: 2px solid #10b981;
  }
  .legal-box {
    background: #f8fafc;
    border-left: 3px solid #3b82f6;
    padding: 10px 12px;
    font-size: 11.5px;
    color: #334155;
    line-height: 1.5;
    margin-bottom: 14px;
    border-radius: 0 4px 4px 0;
  }
  .extenso-box {
    background: #f1f5f9;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    color: #0f172a;
    margin-bottom: 14px;
  }
  .signatures-area {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
    margin-top: 24px;
    padding-top: 12px;
  }
  .sig-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .sig-line {
    width: 100%;
    max-width: 280px;
    border-top: 1px solid #475569;
    padding-top: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #1e293b;
  }
  .sig-sub {
    font-size: 10px;
    color: #64748b;
  }

  @media screen and (max-width: 640px) {
    body { padding: 6px; font-size: 12px; }
    .doc-container { padding: 10px; border-radius: 6px; }
    .header-card { padding: 10px 12px; flex-direction: column; align-items: flex-start; }
    .header-title { font-size: 14px; }
    .grid-2, .grid-3 { grid-template-columns: 1fr; gap: 8px; }
    .signatures-area { grid-template-columns: 1fr; gap: 20px; }
    .sig-line { max-width: 100%; }
  }

  @media print {
    @page { size: A4 portrait; margin: 10mm; }
    body { background: #ffffff !important; padding: 0 !important; color: #000000 !important; }
    .doc-container { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
    .header-card { background: #0f172a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table.formal-table th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table.formal-table tr.net-row td { background: #ecfdf5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

export const generateAvisoHTML = (data: any, autoPrint: boolean = true) => {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Aviso de Férias</title>
      <style>${commonStyles}</style>
    </head>
    <body>
      <div class="doc-container">
        <div class="header-card">
          <div>
            <div class="header-title">Aviso Prévio de Férias</div>
            <div class="header-sub">Concessão e Notificação Legal — Art. 135 da CLT</div>
          </div>
          <div style="font-size:11px; font-weight:600; color:#cbd5e1;">
            Emissão: ${data.dataEmissao || new Date().toLocaleDateString('pt-BR')}
          </div>
        </div>

        <div class="card-section">
          <div class="section-title">Dados do Empregador</div>
          <div class="grid-2">
            <div class="data-item">
              <span class="data-lbl">Razão Social / Nome</span>
              <span class="data-val">${data.empresa || '-'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">C.N.P.J.</span>
              <span class="data-val nowrap">${data.cnpj || '-'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Endereço</span>
              <span class="data-val">${data.endereco || '-'} - ${data.bairro || ''}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Cidade / UF / CEP</span>
              <span class="data-val">${data.cidade || '-'} ${data.cep ? '• CEP: ' + data.cep : ''}</span>
            </div>
          </div>
        </div>

        <div class="card-section">
          <div class="section-title">Dados do Colaborador</div>
          <div class="grid-3">
            <div class="data-item">
              <span class="data-lbl">Nome Completo</span>
              <span class="data-val">${data.empregado || '-'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">CPF / CTPS</span>
              <span class="data-val nowrap">${data.ctps || '-'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Função / Cargo</span>
              <span class="data-val">${data.funcao || 'Colaborador'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Registro / Filial</span>
              <span class="data-val">${data.registro || '-'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Centro de Custo</span>
              <span class="data-val">${data.centroCusto || '-'}</span>
            </div>
          </div>
        </div>

        <div class="card-section">
          <div class="section-title">Período de Férias e Prazos</div>
          <div class="grid-2">
            <div class="data-item">
              <span class="data-lbl">Período Aquisitivo</span>
              <span class="data-val">${data.paInicio || '-'} à ${data.paFim || '-'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Período de Gozo</span>
              <span class="data-val nowrap" style="color:#0284c7;">${data.gozoInicio || '-'} à ${data.gozoFim || '-'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Disponibilidade de Pagamento</span>
              <span class="data-val nowrap" style="color:#16a34a;">${data.dataPagamento || '-'} (Art. 145 CLT)</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Retorno ao Trabalho</span>
              <span class="data-val nowrap">Primeiro dia útil após ${data.gozoFim || '-'}</span>
            </div>
          </div>
        </div>

        <div class="legal-box">
          Em cumprimento ao disposto no <strong>Artigo 135 da Consolidação das Leis do Trabalho (CLT)</strong>, comunicamos que lhe serão concedidas férias regulamentares relativas ao período aquisitivo discriminado acima. A remuneração das férias com o acréscimo de 1/3 constitucional será colocada à sua disposição até 2 (dois) dias antes do início do respectivo período de fruição (Art. 145 da CLT). Solicitamos a apresentação de sua Carteira de Trabalho e Previdência Social para as devidas anotações no Departamento Pessoal.
        </div>

        <div class="signatures-area">
          <div class="sig-col">
            <div class="sig-line">${data.empresa || 'Empregador'}</div>
            <div class="sig-sub">Assinatura do Empregador</div>
          </div>
          <div class="sig-col">
            <div class="sig-line">${data.empregado || 'Colaborador'}</div>
            <div class="sig-sub">Ciente do Empregado em: ${data.dataEmissao || new Date().toLocaleDateString('pt-BR')}</div>
          </div>
        </div>
      </div>
      ${autoPrint ? `<script>window.onload = () => window.print();</script>` : ''}
    </body>
    </html>
  `;
};

export const generateReciboHTML = (data: any, autoPrint: boolean = true) => {
  const c = calculateVacationReceipt(data.salarioBase, data.diasGozo, data.diasAbono, data.gozoStartDateRaw);
  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const valorExtenso = numberToWordsPtBr(c.liquido);

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recibo de Férias</title>
      <style>${commonStyles}</style>
    </head>
    <body>
      <div class="doc-container">
        <div class="header-card">
          <div>
            <div class="header-title">Recibo de Quitação de Férias</div>
            <div class="header-sub">Demonstrativo de Pagamento Trabalhista — Art. 145 da CLT</div>
          </div>
          <div style="font-size:11px; font-weight:600; color:#cbd5e1;">
            Emissão: ${data.dataEmissao || new Date().toLocaleDateString('pt-BR')}
          </div>
        </div>

        <div class="card-section">
          <div class="section-title">Dados Cadastrais</div>
          <div class="grid-2">
            <div class="data-item">
              <span class="data-lbl">Empregador</span>
              <span class="data-val">${data.empresa || '-'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">C.N.P.J.</span>
              <span class="data-val nowrap">${data.cnpj || '-'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Colaborador</span>
              <span class="data-val" style="text-transform:uppercase;">${data.empregado || '-'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">CPF / CTPS</span>
              <span class="data-val nowrap">${data.ctps || '-'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Função / Cargo</span>
              <span class="data-val">${data.funcao || 'Colaborador'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Salário Base Contratual</span>
              <span class="data-val nowrap" style="color:#0f172a;">R$ ${formatMoney(data.salarioBase || 0)}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Centro de Custo</span>
              <span class="data-val">${data.centroCusto || '-'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Dados Bancários</span>
              <span class="data-val">${data.bancoAgencia ? data.bancoAgencia + (data.contaCorrente ? ' • CC: ' + data.contaCorrente : '') : 'Crédito em Conta'}</span>
            </div>
          </div>
        </div>

        <div class="card-section">
          <div class="section-title">Período de Fruição e Concessão</div>
          <div class="grid-2">
            <div class="data-item">
              <span class="data-lbl">Período Aquisitivo</span>
              <span class="data-val">${data.paInicio || '-'} à ${data.paFim || '-'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Período de Gozo</span>
              <span class="data-val nowrap" style="color:#0284c7;">${data.gozoInicio || '-'} à ${data.gozoFim || '-'} (${data.diasGozo} dias)</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Data Limite de Pagamento (CLT 145)</span>
              <span class="data-val nowrap" style="color:#16a34a;">${data.dataPagamento || '-'}</span>
            </div>
            <div class="data-item">
              <span class="data-lbl">Abono Pecuniário (Conversão 1/3)</span>
              <span class="data-val">${data.diasAbono > 0 ? data.diasAbono + ' dias convertidos' : 'Não optante'}</span>
            </div>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="formal-table">
            <thead>
              <tr>
                <th style="width:10%;">Cód.</th>
                <th style="width:45%;">Descrição da Verba</th>
                <th class="num" style="width:15%;">Referência</th>
                <th class="num" style="width:15%;">Proventos (R$)</th>
                <th class="num" style="width:15%;">Descontos (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${c.m1Ferias > 0 ? `
              <tr>
                <td>501</td>
                <td>Férias - ${c.m1Str}</td>
                <td class="num">${c.m1Days}d</td>
                <td class="num">${formatMoney(c.m1Ferias)}</td>
                <td class="num">-</td>
              </tr>` : ''}
              ${c.m1Ferias13 > 0 ? `
              <tr>
                <td>502</td>
                <td>1/3 Constitucional de Férias - ${c.m1Str}</td>
                <td class="num">33,33%</td>
                <td class="num">${formatMoney(c.m1Ferias13)}</td>
                <td class="num">-</td>
              </tr>` : ''}
              ${c.m2Ferias > 0 ? `
              <tr>
                <td>501</td>
                <td>Férias - ${c.m2Str}</td>
                <td class="num">${c.m2Days}d</td>
                <td class="num">${formatMoney(c.m2Ferias)}</td>
                <td class="num">-</td>
              </tr>` : ''}
              ${c.m2Ferias13 > 0 ? `
              <tr>
                <td>502</td>
                <td>1/3 Constitucional de Férias - ${c.m2Str}</td>
                <td class="num">33,33%</td>
                <td class="num">${formatMoney(c.m2Ferias13)}</td>
                <td class="num">-</td>
              </tr>` : ''}
              ${c.abono > 0 ? `
              <tr>
                <td>503</td>
                <td>Abono Pecuniário (Venda de Férias)</td>
                <td class="num">${data.diasAbono}d</td>
                <td class="num">${formatMoney(c.abono)}</td>
                <td class="num">-</td>
              </tr>` : ''}
              ${c.abono13 > 0 ? `
              <tr>
                <td>504</td>
                <td>1/3 Constitucional sobre Abono</td>
                <td class="num">33,33%</td>
                <td class="num">${formatMoney(c.abono13)}</td>
                <td class="num">-</td>
              </tr>` : ''}
              ${c.m1Inss > 0 ? `
              <tr>
                <td>901</td>
                <td>INSS sobre Férias - ${c.m1Str}</td>
                <td class="num">Tab. Of.</td>
                <td class="num">-</td>
                <td class="num">${formatMoney(c.m1Inss)}</td>
              </tr>` : ''}
              ${c.m2Inss > 0 ? `
              <tr>
                <td>901</td>
                <td>INSS sobre Férias - ${c.m2Str}</td>
                <td class="num">Tab. Of.</td>
                <td class="num">-</td>
                <td class="num">${formatMoney(c.m2Inss)}</td>
              </tr>` : ''}
              ${c.irrf > 0 ? `
              <tr>
                <td>902</td>
                <td>IRRF sobre Férias</td>
                <td class="num">Tab. Prog.</td>
                <td class="num">-</td>
                <td class="num">${formatMoney(c.irrf)}</td>
              </tr>` : ''}
              
              <tr class="total-row">
                <td colspan="3" style="text-align:right; font-weight:700;">TOTAIS:</td>
                <td class="num" style="font-weight:700;">${formatMoney(c.totalProventos)}</td>
                <td class="num" style="font-weight:700;">${formatMoney(c.totalDescontos)}</td>
              </tr>
              <tr class="net-row">
                <td colspan="3" style="text-align:right; font-weight:800; font-size:13px; text-transform:uppercase;">VALOR LÍQUIDO A RECEBER:</td>
                <td colspan="2" class="num" style="font-weight:800; font-size:14px; text-align:right;">R$ ${formatMoney(c.liquido)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="extenso-box">
          <strong>Valor por Extenso:</strong> ${valorExtenso}
        </div>

        <div class="legal-box">
          Recebi de <strong>${data.empresa || 'Empregador'}</strong> a importância líquida de <strong>R$ ${formatMoney(c.liquido)}</strong> (${valorExtenso}), referente ao pagamento das férias e adicional de 1/3 constitucional descritos neste demonstrativo, nos estritos termos do <strong>Artigo 145 da CLT</strong>, dando à empresa plena, geral e irrevogável quitação dos valores aqui discriminados.
        </div>

        <div class="signatures-area">
          <div class="sig-col">
            <div class="sig-line">${data.empresa || 'Empregador'}</div>
            <div class="sig-sub">Assinatura da Empresa</div>
          </div>
          <div class="sig-col">
            <div class="sig-line">${data.empregado || 'Colaborador'}</div>
            <div class="sig-sub">Assinatura do Empregado • Data: ${data.dataEmissao || new Date().toLocaleDateString('pt-BR')}</div>
          </div>
        </div>
      </div>
      ${autoPrint ? `<script>window.onload = () => window.print();</script>` : ''}
    </body>
    </html>
  `;
};

