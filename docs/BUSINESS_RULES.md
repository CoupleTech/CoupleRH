# Regras de Negócio e Compliance Trabalhista

A plataforma obedece aos seguintes princípios absolutos:
1. **Nunca gravar valores legais (alíquotas, limites) diretamente no código.**
   * As regras devem ser versionadas em banco de dados e ter vigência.
2. **Imutabilidade da Folha Fechada.**
   * Nenhuma alteração retroativa silenciosa é permitida. Modificações em meses anteriores exigem folha complementar, reabertura auditada ou correção via eSocial.
3. **Privacidade Médica Estrita (LGPD).**
   * Gestores diretos NUNCA devem ter acesso ao CID (diagnóstico médico) do colaborador, apenas aos dias de atestado/afastamento.
4. **Proteção da Marcação de Ponto.**
   * A marcação bruta de ponto eletrônico é intocável. Correções são tratadas como ajustes com trilha de aprovação, mantendo sempre o horário original.
5. **Cálculo Determinístico.**
   * A engine da folha deve produzir o mesmo resultado para os mesmos inputs e garantir total transparência (Memória de Cálculo visível).
