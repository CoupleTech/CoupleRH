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
  const m1Ferias = Math.round(((baseSalary / 30) * m1Days) * 100) / 100;
  const m1Ferias13 = Math.round((m1Ferias / 3) * 100) / 100;

  const m2Ferias = m2Days > 0 ? Math.round(((baseSalary / 30) * m2Days) * 100) / 100 : 0;
  const m2Ferias13 = m2Days > 0 ? Math.round((m2Ferias / 3) * 100) / 100 : 0;
  
  const abono = Math.round(((baseSalary / 30) * cashAllowanceDays) * 100) / 100;
  const abono13 = Math.round((abono / 3) * 100) / 100;

  const totalProventos = m1Ferias + m1Ferias13 + m2Ferias + m2Ferias13 + abono + abono13;
  
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
    return Math.round(inss * 100) / 100;
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
  irrf = Math.round(irrf * 100) / 100;

  const totalDescontos = totalInss + irrf;
  const liquido = totalProventos - totalDescontos;
  
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

export const generateAvisoHTML = (data: any, autoPrint: boolean = true) => {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Aviso de Férias</title>
      <style>
        @media print {
          @page { size: A4; margin: 15mm; }
          body { padding: 0 !important; margin: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .box, .header-box { break-inside: avoid; page-break-inside: avoid; }
        }
        * { box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; padding: 10px; font-size: 12px; color: #000; }
        .box { border: 2px solid #333; margin-bottom: 8px; border-radius: 4px; overflow: hidden; }
        .header-box { display: flex; align-items: stretch; border: 2px solid #333; border-radius: 8px; margin-bottom: 8px; background: #e5e7eb; overflow: hidden; }
        .logo-area { width: 150px; background: #fff; padding: 10px; border-right: 2px solid #333; display: flex; align-items: center; justify-content: center; }
        .title-area { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: bold; text-transform: uppercase; }
        .section { padding: 6px 10px; display: flex; flex-wrap: wrap; }
        .row { width: 100%; display: flex; margin-bottom: 4px; }
        .col-left { width: 65%; padding-right: 10px; }
        .col-right { width: 35%; }
        .col-full { width: 100%; }
        .lbl { font-weight: normal; color: #333; display: inline-block; width: 130px; flex-shrink: 0; }
        .val { font-weight: bold; flex: 1; word-break: break-word; }
        .table-box { width: 100%; border-collapse: collapse; text-align: center; margin-top: 10px; }
        .table-box th { border: 1px solid #333; background: #e5e7eb; padding: 6px; font-weight: normal; }
        .table-box td { border: 1px solid #333; padding: 6px; }
        .text-content { margin-top: 10px; text-align: justify; line-height: 1.4; padding: 8px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding: 0 40px; }
        .sig-line { width: 45%; border-top: 1px solid #000; text-align: center; padding-top: 5px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header-box">
        <div class="logo-area">
          <!-- Logo empty as requested -->
        </div>
        <div class="title-area">Aviso de Férias</div>
      </div>
      
      <div class="box section">
        <div class="col-left">
          <div class="row"><span class="lbl">Empregador:</span><span class="val">${data.empresa}</span></div>
          <div class="row"><span class="lbl">C.N.P.J.:</span><span class="val">${data.cnpj}</span></div>
          <div class="row"><span class="lbl">Endereço:</span><span class="val">${data.endereco}</span></div>
          <div class="row"><span class="lbl">Cidade:</span><span class="val">${data.cidade}</span></div>
        </div>
        <div class="col-right">
          <div class="row"><span class="lbl">&nbsp;</span></div>
          <div class="row"><span class="lbl">&nbsp;</span></div>
          <div class="row"><span class="lbl" style="width:70px;">Bairro:</span><span class="val">${data.bairro}</span></div>
          <div class="row"><span class="lbl" style="width:70px;">CEP:</span><span class="val">${data.cep}</span></div>
        </div>
      </div>

      <div class="box section">
        <div class="col-full" style="margin-bottom:10px;">
          <strong>${data.cidade}, ${data.dataEmissao}</strong>
        </div>
        <div class="col-full" style="margin-bottom:4px;">Sr.(a)</div>
        <div class="col-left">
          <div class="row"><span class="val" style="font-size:14px; text-transform:uppercase;">${data.empregado}</span></div>
          <div class="row"><span class="lbl">CTPS Nº/Série/UF:</span><span class="val">${data.ctps}</span></div>
        </div>
        <div class="col-right">
          <div class="row"><span class="lbl" style="width:110px;">Filial/Registro:</span><span class="val">${data.registro}</span></div>
          <div class="row"><span class="lbl" style="width:110px;">Centro de Custo:</span><span class="val">${data.centroCusto}</span></div>
        </div>
        
        <div class="col-full" style="margin-top:20px;">
          Nos termos das disposições legais vigentes, suas férias serão concedidas conforme o demonstrativo abaixo:
        </div>

        <table class="table-box">
          <tr>
            <th>Período aquisitivo</th>
            <th>Período de gozo</th>
          </tr>
          <tr>
            <td>${data.paInicio} à ${data.paFim}</td>
            <td>${data.gozoInicio} à ${data.gozoFim}</td>
          </tr>
          <tr>
            <td>Licença Remunerada.</td>
            <td></td>
          </tr>
        </table>

        <div class="text-content">
          A remuneração correspondente as férias encontra-se-a disposição em ${data.dataPagamento}, devendo retornar ao trabalho no primeiro dia útil após o término do período de gozo.<br/>
          Favor apresentar a sua Carteira de Trabalho e Previdência Social ao Recursos Humanos, para as anotações necessárias.
        </div>
      </div>

      <div class="signatures">
        <div class="sig-line">${data.empresa}</div>
        <div class="sig-line">${data.empregado}</div>
      </div>
      ${autoPrint ? `<script>window.onload = () => window.print();</script>` : ''}
    </body>
    </html>
  `;
};

export const generateReciboHTML = (data: any, autoPrint: boolean = true) => {
  const c = calculateVacationReceipt(data.salarioBase, data.diasGozo, data.diasAbono, data.gozoStartDateRaw);
  
  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Recibo de Férias</title>
      <style>
        @media print {
          @page { size: A4; margin: 15mm; }
          body { padding: 0 !important; margin: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .box, .header-box { break-inside: avoid; page-break-inside: avoid; }
        }
        * { box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; padding: 10px; font-size: 12px; color: #000; }
        .box { border: 2px solid #333; margin-bottom: 5px; border-radius: 4px; overflow: hidden; }
        .header-box { display: flex; align-items: stretch; border: 2px solid #333; border-radius: 8px; margin-bottom: 5px; background: #e5e7eb; overflow: hidden; }
        .logo-area { width: 150px; background: #fff; padding: 10px; border-right: 2px solid #333; display: flex; align-items: center; justify-content: center; }
        .title-area { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: bold; text-transform: uppercase; }
        .section { padding: 4px 10px; display: flex; flex-wrap: wrap; }
        .row { width: 100%; display: flex; margin-bottom: 2px; }
        .col-left { width: 65%; padding-right: 10px; }
        .col-right { width: 35%; }
        .col-full { width: 100%; }
        .lbl { font-weight: normal; color: #333; display: inline-block; width: 130px; flex-shrink: 0; }
        .lbl-sm { width: 110px; display: inline-block; flex-shrink: 0; }
        .val { font-weight: bold; flex: 1; word-break: break-word; }
        
        .table-header { text-align: center; background: #e5e7eb; font-weight: bold; padding: 4px; border-bottom: 2px solid #333; text-transform: uppercase; }
        .verbas-table { width: 100%; border-collapse: collapse; }
        .verbas-table th, .verbas-table td { border-right: 1px solid #333; padding: 2px 8px; }
        .verbas-table th:last-child, .verbas-table td:last-child { border-right: none; }
        .verbas-table th { border-bottom: 1px solid #333; font-weight: normal; }
        .verbas-table td:nth-child(2), .verbas-table td:nth-child(3), .verbas-table td:nth-child(4) { text-align: right; }
        .totals-row { border-top: 1px solid #333; font-weight: bold; }
        .liquido-row { background: #e5e7eb; font-weight: bold; font-size: 14px; border-top: 2px solid #333;}
        
        .footer-text { margin-top: 15px; margin-bottom: 30px; padding: 0 10px; text-align: justify; }
        .signature-line { width: 300px; border-top: 1px solid #000; text-align: center; padding-top: 5px; font-weight: bold; margin-left: 10px; }
      </style>
    </head>
    <body>
      <div class="header-box">
        <div class="logo-area">
          <!-- Logo empty as requested -->
        </div>
        <div class="title-area">RECIBO DE FÉRIAS</div>
      </div>
      
      <div class="box section">
        <div class="col-left">
          <div class="row"><span class="lbl">Empregador:</span><span class="val">${data.empresa}</span></div>
        </div>
        <div class="col-right">
          <div class="row"><span class="lbl lbl-sm">C.N.P.J.:</span><span class="val">${data.cnpj}</span></div>
        </div>
      </div>

      <div class="box section">
        <div class="col-left">
          <div class="row"><span class="lbl">Empregado:</span><span class="val" style="text-transform:uppercase;">${data.empregado}</span></div>
          <div class="row"><span class="lbl">CTPS Nº/Série:</span><span class="val">${data.ctps}</span></div>
          <div class="row"><span class="lbl">Função:</span><span class="val">${data.funcao}</span></div>
          <div class="row"><span class="lbl">Banco/Agência:</span><span class="val">${data.bancoAgencia}</span></div>
          <div class="row"><span class="lbl">Centro de Custo:</span><span class="val">${data.centroCusto}</span></div>
        </div>
        <div class="col-right">
          <div class="row"><span class="lbl lbl-sm">Filial/Registro:</span><span class="val">${data.registro}</span></div>
          <div class="row"><span class="lbl lbl-sm">Dependentes IR:</span><span class="val">00</span></div>
          <div class="row"><span class="lbl lbl-sm">Salário base:</span><span class="val">${formatMoney(data.salarioBase)}</span></div>
          <div class="row"><span class="lbl lbl-sm">Conta Corrente:</span><span class="val">${data.contaCorrente}</span></div>
        </div>
      </div>

      <div class="box section">
        <div class="col-left">
          <div class="row"><span class="lbl" style="width:180px;">Período aquisitivo de:</span><span class="val">${data.paInicio} à ${data.paFim}</span></div>
          <div class="row"><span class="lbl" style="width:180px;">Período de gozo de:</span><span class="val">${data.gozoInicio} à ${data.gozoFim}</span></div>
        </div>
        <div class="col-right">
          <div class="row"><span class="lbl" style="width:180px;">Quantidade de dias de férias:</span><span class="val">${data.diasGozo} dias</span></div>
          <div class="row"><span class="lbl" style="width:180px;">Quantidade de Dias de Abono:</span><span class="val">${data.diasAbono} dias</span></div>
        </div>
      </div>

      <div class="box">
        <div class="table-header">DEMONSTRATIVO DAS VerbasView</div>
        <table class="verbas-table">
          <tr>
            <th style="text-align:left;">Descrição das VerbasView</th>
            <th style="width:80px;">Quantidade</th>
            <th style="width:100px;">Vencimentos</th>
            <th style="width:100px;">Descontos</th>
          </tr>
          ${c.m1Ferias > 0 ? `<tr><td>501 - Férias - ${c.m1Str}</td><td>${c.m1Days},00</td><td>${formatMoney(c.m1Ferias)}</td><td></td></tr>` : ''}
          ${c.m1Ferias13 > 0 ? `<tr><td>502 - Férias 1/3 - ${c.m1Str}</td><td>0,00</td><td>${formatMoney(c.m1Ferias13)}</td><td></td></tr>` : ''}
          
          ${c.m2Ferias > 0 ? `<tr><td>501 - Férias - ${c.m2Str}</td><td>${c.m2Days},00</td><td>${formatMoney(c.m2Ferias)}</td><td></td></tr>` : ''}
          ${c.m2Ferias13 > 0 ? `<tr><td>502 - Férias 1/3 - ${c.m2Str}</td><td>0,00</td><td>${formatMoney(c.m2Ferias13)}</td><td></td></tr>` : ''}

          ${c.abono > 0 ? `<tr><td>503 - Abono Pecuniário</td><td>${data.diasAbono},00</td><td>${formatMoney(c.abono)}</td><td></td></tr>` : ''}
          ${c.abono13 > 0 ? `<tr><td>504 - Abono Pecuniário 1/3</td><td>0,00</td><td>${formatMoney(c.abono13)}</td><td></td></tr>` : ''}
          
          ${c.m1Inss > 0 ? `<tr><td>901 - INSS Férias - ${c.m1Str}</td><td>0,00</td><td></td><td>${formatMoney(c.m1Inss)}</td></tr>` : ''}
          ${c.m2Inss > 0 ? `<tr><td>901 - INSS Férias - ${c.m2Str}</td><td>0,00</td><td></td><td>${formatMoney(c.m2Inss)}</td></tr>` : ''}
          ${c.irrf > 0 ? `<tr><td>902 - IRRF Férias Recibo</td><td>0,00</td><td></td><td>${formatMoney(c.irrf)}</td></tr>` : ''}
          
          <tr class="totals-row">
            <td></td>
            <td style="text-align:center;">TOTAL</td>
            <td>${formatMoney(c.totalProventos)}</td>
            <td>${formatMoney(c.totalDescontos)}</td>
          </tr>
          <tr class="liquido-row">
            <td></td>
            <td colspan="2" style="text-align:center;">LÍQUIDO A RECEBER</td>
            <td style="background:#fff;">${formatMoney(c.liquido)}</td>
          </tr>
        </table>
      </div>

      <div class="footer-text">
        Recebi a importância líquida, referente os lançamentos acima discriminados, em virtude do gozo de minhas férias.<br/>
        Para maior clareza, firmo o presente recibo.
        <br/><br/><br/>
        ${data.cidade}, ${data.dataPagamento}
      </div>

      <div class="signature-line">
        ${data.empregado}
      </div>
      ${autoPrint ? `<script>window.onload = () => window.print();</script>` : ''}
    </body>
    </html>
  `;
};
