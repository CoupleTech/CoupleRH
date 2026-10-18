# CoupleRH — Runbook de Continuidade de Negócios e Recuperação de Desastres (PITR)

**Documento Operacional de Infraestrutura e Resiliência (Fase P8 / §9)**  
**Versão:** 1.0  
**Data:** 16/10/2026  
**Responsável Técnico:** Departamento de Engenharia e Segurança da Informação  

---

## 1. Objetivos de Recuperação e SLA

| Parâmetro | Meta | Justificativa Legal / Operacional |
|---|---|---|
| **RPO (Recovery Point Objective)** | **≤ 5 minutos** | Em caso de desastre, a perda máxima de dados permitida é de 5 minutos, garantida pelo Write-Ahead Logging (WAL) contínuo do PostgreSQL. |
| **RTO (Recovery Time Objective)** | **≤ 60 minutos** | O sistema deve estar 100% operacional para os usuários em até 1 hora após a declaração do incidente. |
| **Janela de Retenção PITR** | **7 a 30 dias** | Capacidade de restaurar o banco de dados para qualquer segundo exato dos últimos 7 dias. |
| **Frequência de Restore Drill** | **Trimestral (90 dias)** | Simulação periódica e obrigatória de restauração em ambiente isolado de homologação. |

---

## 2. Arquitetura de Backups

O CoupleRH opera sobre uma arquitetura híbrida de proteção de dados no Supabase e Edge Functions:

1. **Backups Físicos Contínuos (WAL Archiving - PITR)**:
   - Todo comando DDL e DML executado no banco gera registros de transação (Write-Ahead Logs) arquivados em storage geograficamente redundante.
   - Permite a restauração no tempo até o segundo exato anterior a uma corrupção acidental ou deleção lógica.
2. **Snapshots Físicos Diários**:
   - Snapshots completos do disco EBS/PostgreSQL gerados automaticamente todas as madrugadas (janela de menor tráfego: 03:00 UTC-3).
3. **Trilha Imutável de Auditoria (`audit.logs`)**:
   - Tabela append-only com trigger de proteção contra `UPDATE` e `DELETE` (Migration 00101). Permite reconstrução forense de eventos mesmo durante auditoria.
4. **Storage Privado de Documentos e Assinaturas**:
   - Bucket `private-documents` com versionamento e redundância multizona (AWS S3 / Supabase Storage).

---

## 3. Procedimento Operacional de Restauração (PITR)

### Cenário A: Incidente de Corrupção de Dados ou Exclusão Acidental

Quando um operador ou falha catastrófica afetar dados de produção (exemplo: fechamento indevido ou exclusão acidental de competência):

#### Passo 1 — Identificação do Timestamp Exato de Incidente
Consulte a trilha de auditoria para identificar o segundo imediatamente anterior à anomalia:
```sql
SELECT 
    created_at, 
    action, 
    table_name, 
    user_id, 
    old_data 
FROM audit.logs 
ORDER BY created_at DESC 
LIMIT 20;
```
*Exemplo:* O erro ocorreu em `2026-10-16 15:42:18 UTC`. O alvo de restauração será `2026-10-16 15:42:00 UTC`.

#### Passo 2 — Colocar a Aplicação em Modo de Manutenção
No painel da Vercel ou via Edge Config:
```bash
vercel env add MAINTENANCE_MODE true production
```

#### Passo 3 — Executar o Point-in-Time Recovery (Dashboard Supabase)
1. Acesse o projeto de produção no Supabase (`Settings` → `Database` → `Backups`).
2. Clique na aba **Point in Time**.
3. Selecione a data e o horário exato determinado no Passo 1 (com margem de 1 minuto anterior).
4. Confirme o início do processo de clonagem/restauração da base de dados.
5. O Supabase provisiona a réplica pontual e atualiza os ponteiros do pooler transacional (PgBouncer/Supavisor).

#### Passo 4 — Validação de Integridade Pós-Restauração (Checklist)
Antes de liberar o acesso aos usuários, execute o script de verificação:
```sql
-- 1. Conferência de Rubricas Ativas
SELECT count(*) FROM public.payroll_rubrics WHERE is_active = true;

-- 2. Conferência de Holerites Fechados
SELECT count(*) FROM public.payslips WHERE status = 'CLOSED';

-- 3. Validação de Invariantes Contábeis
SELECT p.id, p.total_earnings, p.total_deductions,
  coalesce(sum(i.amount) filter (where i.type='EARNING'),0) itens_prov,
  coalesce(sum(i.amount) filter (where i.type='DEDUCTION'),0) itens_desc
FROM payslips p 
LEFT JOIN payslip_items i ON i.payslip_id = p.id 
GROUP BY p.id
HAVING abs(p.total_earnings - coalesce(sum(i.amount) filter (where i.type='EARNING'),0)) > 0.01;

-- 4. Verificação de Imutabilidade do Ponto e Assinaturas
SELECT count(*) FROM public.time_punch_records;
SELECT count(*) FROM public.employee_documents WHERE status = 'SIGNED';
```
*Critério de Aceite:* Todas as queries devem retornar 0 divergências.

#### Passo 5 — Restabelecimento do Tráfego
1. Desative o modo de manutenção na Vercel:
```bash
vercel env add MAINTENANCE_MODE false production
```
2. Emita comunicado de restabelecimento do serviço e encerramento do incidente.

---

## 4. Política de Rotação Periódica de Segredos

| Segredo | Localização | Frequência | Procedimento de Rotação |
|---|---|---|---|
| **JWT Secret** | Supabase Auth Provider | 90 dias | Atualizar no dashboard do Supabase (`API Settings`). Usuários ativos serão solicitados a fazer login novamente. |
| **Supabase Service Role Key** | Edge Functions / GitHub Actions | 180 dias | 1. Gerar nova chave no Supabase.<br>2. Atualizar secrets no Supabase Edge Runtime.<br>3. Atualizar secrets no CI/CD da Vercel.<br>4. Revogar a chave antiga após 15 minutos. |
| **API Keys de Coletores REP** | Tabela `time_devices` | 90 dias | Executar `SecretRotationService.executeDeviceApiKeyRotationInDb(deviceId)` e atualizar o arquivo de configuração no agente local da Control iD. |
| **Database Master Password** | Supabase Database | 90 dias | Rotacionar em janela de manutenção programada (domingo às 02h). |

---

## 5. Simulação Periódica de Restauração (Restore Drill)

Todo trimestre, a equipe de engenharia deve:
1. Restaurar o backup PITR do dia anterior em um projeto de teste/staging.
2. Rodar a suíte completa de testes automatizados (`npx vitest run`).
3. Registrar a ata de teste com data, duração da restauração e responsável.
