const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🤖 Iniciando o Simulador de Operador (Playwright)...');
  
  // Usamos slowMo para que o usuário possa ver as ações acontecendo como se fosse uma pessoa
  const browser = await chromium.launch({ headless: false, slowMo: 800 }); 
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  let relatorio = '# Relatório de Validação da Folha (Extração Via Tela)\n\n';

  const extrairTexto = async (titulo) => {
    // Tenta extrair da tag <main>, se não achar pega do <body> inteiro
    const mainExiste = await page.locator('main').count();
    let texto = '';
    if (mainExiste > 0) {
      texto = await page.locator('main').innerText();
    } else {
      texto = await page.locator('body').innerText();
    }
    relatorio += `## ${titulo}\n\`\`\`\n${texto}\n\`\`\`\n\n`;
  };

  try {
    console.log('🌐 Acessando o sistema (http://localhost:5173)...');
    await page.goto('http://localhost:5173');
    
    // Tratar possível botão de boas-vindas antes do login
    const acessarBtn = page.getByText('Acessar Sistema', { exact: false });
    if (await acessarBtn.count() > 0) {
      await acessarBtn.first().click();
      await page.waitForTimeout(1000);
    }

    console.log('🔑 Realizando login...');
    // Tentamos encontrar os inputs mais comuns
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[name*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    await emailInput.fill('cf95.souza@gmail.com');
    await passwordInput.fill('140415');
    
    // Clica em um botão que pareça ser o de entrar
    await page.getByRole('button', { name: /entrar|login|acessar/i }).first().click();

    console.log('⏳ Aguardando carregamento do Dashboard...');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // tempo extra para renderizar as listagens

    console.log('👥 Navegando para Colaboradores...');
    // Busca no menu lateral ou topo
    await page.getByText(/colaboradores|funcionários|pessoas/i).first().click();
    await page.waitForTimeout(2000);
    await extrairTexto('Colaboradores e Salários');

    console.log('📄 Navegando para Rubricas...');
    // Se o menu for dropdown, pode ser necessário clicar nele antes
    const folhaMenu = page.getByText(/folha de pagamento/i);
    if (await folhaMenu.count() > 0) {
      await folhaMenu.first().click();
      await page.waitForTimeout(500);
    }
    await page.getByText(/rubricas/i).first().click();
    await page.waitForTimeout(2000);
    await extrairTexto('Rubricas Cadastradas');

    console.log('📅 Navegando para Eventos/Lançamentos...');
    if (await folhaMenu.count() > 0) {
      await folhaMenu.first().click();
      await page.waitForTimeout(500);
    }
    await page.getByText(/eventos|lançamentos/i).first().click();
    await page.waitForTimeout(2000);
    await extrairTexto('Lançamentos Variáveis e Descontos');

    console.log('🧮 Navegando para Cálculos...');
    if (await folhaMenu.count() > 0) {
      await folhaMenu.first().click();
      await page.waitForTimeout(500);
    }
    await page.getByText(/cálculos|processamento/i).first().click();
    await page.waitForTimeout(2000);

    console.log('⚙️ Processando a Folha...');
    const processarBtn = page.getByText(/processar|calcular|gerar folha/i);
    if (await processarBtn.count() > 0) {
      await processarBtn.first().click();
      console.log('⏳ Aguardando o motor de cálculo...');
      await page.waitForTimeout(4000); // Aguarda o cálculo concluir e renderizar na tela
    } else {
      console.log('⚠️ Botão de Processar não encontrado. Extraindo a tela atual mesmo assim.');
    }
    
    // Tentar abrir um recibo para pegar a memória se possível, mas vamos extrair a tela de cálculos por enquanto
    await extrairTexto('Resultados do Cálculo (Motor de Folha)');

  } catch (err) {
    console.error('❌ Erro durante a execução do simulador:', err);
    relatorio += `\n\n## Erro Encontrado na Simulação\n\`\`\`\n${err.message}\n\`\`\`\n`;
  } finally {
    console.log('💾 Salvando arquivo de controle...');
    fs.writeFileSync('controle_validacao_folha.md', relatorio, 'utf-8');
    await browser.close();
    console.log('✅ Simulação concluída! O navegador foi fechado. Verifique o arquivo controle_validacao_folha.md.');
  }
})();
