export const calculateVacationReceipt = (
  baseSalary: number,
  daysTaken: number,
  cashAllowanceDays: number,
  dependents: number = 0
) => {
  // 1. Proventos
  const ferias = Math.round(((baseSalary / 30) * daysTaken) * 100) / 100;
  const ferias13 = Math.round((ferias / 3) * 100) / 100;
  
  const abono = Math.round(((baseSalary / 30) * cashAllowanceDays) * 100) / 100;
  const abono13 = Math.round((abono / 3) * 100) / 100;

  const totalProventos = ferias + ferias13 + abono + abono13;
  const baseTributavel = ferias + ferias13; // Abono é isento

  // 2. Descontos - INSS (Tabela 2026/Fase.md simplificada)
  let inss = 0;
  const inssBrackets = [
    { limit: 1621.00, rate: 7.5 },
    { limit: 2902.84, rate: 9.0 },
    { limit: 4354.27, rate: 12.0 },
    { limit: 8475.55, rate: 14.0 }
  ];
  
  let calcBase = Math.min(baseTributavel, 8475.55);
  let currentBase = 0;
  for (const b of inssBrackets) {
    if (calcBase > currentBase) {
      const taxable = Math.min(calcBase, b.limit) - currentBase;
      inss += taxable * (b.rate / 100);
    }
    currentBase = b.limit;
  }
  inss = Math.round(inss * 100) / 100;

  // 3. Descontos - IRRF
  const deducaoDependentes = dependents * 189.59;
  const baseIRRF = baseTributavel - inss - deducaoDependentes;
  const baseSimplificada = baseTributavel - 607.20;
  
  const calcBaseIRRF = Math.max(0, Math.min(baseIRRF, baseSimplificada));
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
  if (baseTributavel <= 5000) {
    irrf = Math.max(0, irrf - 312.89);
  } else if (baseTributavel <= 7350) {
    const redutor = 978.62 - (0.133145 * baseTributavel);
    irrf = Math.max(0, irrf - Math.max(0, redutor));
  }
  irrf = Math.round(irrf * 100) / 100;

  const totalDescontos = inss + irrf;
  const liquido = totalProventos - totalDescontos;

  return {
    ferias, ferias13, abono, abono13, inss, irrf, totalProventos, totalDescontos, liquido
  };
};

export const generateAvisoHTML = (data: any) => {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Aviso de Férias</title>
      <style>
        @media print {
          @page { margin: 10mm; }
          body { padding: 0 !important; margin: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .box, .header-box { break-inside: avoid; page-break-inside: avoid; }
        }
        body { font-family: 'Arial', sans-serif; padding: 15px; font-size: 13px; color: #000; }
        .box { border: 2px solid #333; margin-bottom: 10px; border-radius: 4px; overflow: hidden; }
        .header-box { display: flex; align-items: stretch; border: 2px solid #333; border-radius: 8px; margin-bottom: 10px; background: #e5e7eb; overflow: hidden; }
        .logo-area { width: 150px; background: #fff; padding: 10px; border-right: 2px solid #333; display: flex; align-items: center; justify-content: center; }
        .title-area { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; text-transform: uppercase; }
        .section { padding: 8px 12px; display: flex; flex-wrap: wrap; }
        .row { width: 100%; display: flex; margin-bottom: 4px; }
        .col-half { width: 50%; }
        .col-full { width: 100%; }
        .lbl { font-weight: normal; color: #333; display: inline-block; width: 110px; }
        .val { font-weight: bold; flex: 1; }
        .table-box { width: 100%; border-collapse: collapse; text-align: center; margin-top: 15px; }
        .table-box th { border: 1px solid #333; background: #e5e7eb; padding: 6px; font-weight: normal; }
        .table-box td { border: 1px solid #333; padding: 8px; }
        .text-content { margin-top: 15px; text-align: justify; line-height: 1.5; padding: 10px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding: 0 40px; }
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
        <div class="col-half">
          <div class="row"><span class="lbl">Empregador:</span><span class="val">${data.empresa}</span></div>
          <div class="row"><span class="lbl">C.N.P.J.:</span><span class="val">${data.cnpj}</span></div>
          <div class="row"><span class="lbl">Endereço:</span><span class="val">${data.endereco}</span></div>
          <div class="row"><span class="lbl">Cidade:</span><span class="val">${data.cidade}</span></div>
        </div>
        <div class="col-half">
          <br/><br/>
          <div class="row"><span class="lbl">Bairro:</span><span class="val">${data.bairro}</span></div>
          <div class="row"><span class="lbl">CEP:</span><span class="val">${data.cep}</span></div>
        </div>
      </div>

      <div class="box section">
        <div class="col-full" style="margin-bottom:15px;">
          <strong>${data.cidade}, ${data.dataEmissao}</strong>
        </div>
        <div class="col-full" style="margin-bottom:15px;">Sr.(a)</div>
        <div class="col-half">
          <div class="row"><span class="val">${data.empregado}</span></div>
          <div class="row"><span class="lbl">CTPS Nº/Série/UF:</span><span class="val">${data.ctps}</span></div>
        </div>
        <div class="col-half">
          <div class="row"><span class="lbl">Filial/Registro:</span><span class="val">${data.registro}</span></div>
          <div class="row"><span class="lbl">Centro de Custo:</span><span class="val">${data.centroCusto}</span></div>
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
      <script>window.onload = () => window.print();</script>
    </body>
    </html>
  `;
};

export const generateReciboHTML = (data: any) => {
  const c = calculateVacationReceipt(data.salarioBase, data.diasGozo, data.diasAbono);
  
  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Recibo de Férias</title>
      <style>
        @media print {
          @page { margin: 10mm; }
          body { padding: 0 !important; margin: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .box, .header-box { break-inside: avoid; page-break-inside: avoid; }
        }
        body { font-family: 'Arial', sans-serif; padding: 15px; font-size: 13px; color: #000; }
        .box { border: 2px solid #333; margin-bottom: 5px; border-radius: 4px; overflow: hidden; }
        .header-box { display: flex; align-items: stretch; border: 2px solid #333; border-radius: 8px; margin-bottom: 5px; background: #e5e7eb; overflow: hidden; }
        .logo-area { width: 150px; background: #fff; padding: 10px; border-right: 2px solid #333; display: flex; align-items: center; justify-content: center; }
        .title-area { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; text-transform: uppercase; }
        .section { padding: 4px 12px; display: flex; flex-wrap: wrap; }
        .row { width: 100%; display: flex; margin-bottom: 2px; }
        .col-half { width: 50%; }
        .lbl { font-weight: normal; color: #333; display: inline-block; width: 110px; }
        .lbl-sm { width: 100px; display: inline-block; }
        .val { font-weight: bold; flex: 1; }
        
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
        <div class="col-half">
          <div class="row"><span class="lbl">Empregador:</span><span class="val">${data.empresa}</span></div>
        </div>
        <div class="col-half">
          <div class="row"><span class="lbl lbl-sm">C.N.P.J.:</span><span class="val">${data.cnpj}</span></div>
        </div>
      </div>

      <div class="box section">
        <div class="col-half">
          <div class="row"><span class="lbl">Empregado:</span><span class="val">${data.empregado}</span></div>
          <div class="row"><span class="lbl">CTPS Nº/Série:</span><span class="val">${data.ctps}</span></div>
          <div class="row"><span class="lbl">Função:</span><span class="val">${data.funcao}</span></div>
          <div class="row"><span class="lbl">Banco/Agência:</span><span class="val">${data.bancoAgencia}</span></div>
          <div class="row"><span class="lbl">Centro de Custo:</span><span class="val">${data.centroCusto}</span></div>
        </div>
        <div class="col-half">
          <div class="row"><span class="lbl lbl-sm">Filial/Registro:</span><span class="val">${data.registro}</span></div>
          <div class="row"><span class="lbl lbl-sm">Dependentes IR:</span><span class="val">00</span></div>
          <div class="row"><span class="lbl lbl-sm">Salário base:</span><span class="val">${formatMoney(data.salarioBase)}</span></div>
          <div class="row"><span class="lbl lbl-sm">Conta Corrente:</span><span class="val">${data.contaCorrente}</span></div>
        </div>
      </div>

      <div class="box section">
        <div class="col-half">
          <div class="row"><span class="lbl" style="width:180px;">Período aquisitivo de:</span><span class="val">${data.paInicio} à ${data.paFim}</span></div>
          <div class="row"><span class="lbl" style="width:180px;">Período de gozo de:</span><span class="val">${data.gozoInicio} à ${data.gozoFim}</span></div>
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
          ${c.ferias > 0 ? `<tr><td>201 - Férias</td><td>${data.diasGozo},00</td><td>${formatMoney(c.ferias)}</td><td></td></tr>` : ''}
          ${c.ferias13 > 0 ? `<tr><td>202 - Férias 1/3</td><td>0,00</td><td>${formatMoney(c.ferias13)}</td><td></td></tr>` : ''}
          ${c.abono > 0 ? `<tr><td>731 - Abono Pecuniário</td><td>${data.diasAbono},00</td><td>${formatMoney(c.abono)}</td><td></td></tr>` : ''}
          ${c.abono13 > 0 ? `<tr><td>733 - Abono Pecuniário 1/3</td><td>0,00</td><td>${formatMoney(c.abono13)}</td><td></td></tr>` : ''}
          
          <!-- Espaçadores para empurrar os descontos pro final (simulado) -->
          <tr><td style="color:transparent;">.</td><td></td><td></td><td></td></tr>
          <tr><td style="color:transparent;">.</td><td></td><td></td><td></td></tr>
          <tr><td style="color:transparent;">.</td><td></td><td></td><td></td></tr>

          ${c.inss > 0 ? `<tr><td>514 - INSS Férias Recibo - Mês</td><td>0,00</td><td></td><td>${formatMoney(c.inss)}</td></tr>` : ''}
          ${c.irrf > 0 ? `<tr><td>775 - Imposto de Renda Férias Recibo</td><td>0,00</td><td></td><td>${formatMoney(c.irrf)}</td></tr>` : ''}
          
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
      <script>window.onload = () => window.print();</script>
    </body>
    </html>
  `;
};
