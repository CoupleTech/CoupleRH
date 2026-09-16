# Modelo de Auditoria (Audit Log)

O sistema exige registro inalterável de quem, quando, de onde e por quê realizou mudanças.

## Estrutura da Tabela de Auditoria `audit.logs`
- `id`: UUID.
- `timestamp`: timestamptz (UTC).
- `tenant_id`: UUID.
- `actor_id`: UUID (O usuário que fez a ação, JWT sub).
- `action`: Tipo de ação (`INSERT`, `UPDATE`, `DELETE`, `APPROVE`).
- `entity_type`: Tabela/Recurso afetado (ex: `contracts`, `payroll`).
- `entity_id`: ID do recurso.
- `old_values`: JSONB.
- `new_values`: JSONB.
- `ip_address`: (Se legalmente justificado e autorizado).

Nenhum usuário, mesmo admin, tem privilégio de dar `UPDATE` ou `DELETE` na tabela `audit.logs`.
