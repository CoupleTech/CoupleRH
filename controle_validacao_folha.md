# Relatório de Validação da Folha (Extração Via Tela)

## Colaboradores e Salários
```
Organização
Colaboradores
Quadro de Funcionários

Gerencie as pessoas, contratos e o histórico funcional.

Novo Empregado
COLABORADOR	MATRÍCULA (ESOCIAL)	CARGO / SETOR	STATUS	AÇÕES

A

Ana

CPF: 42155666548
	Sem matrícula	

Assistente Administrativo

Administrativo

	Ativo	Ver Perfil

J

João

CPF: 42987844188
	Sem matrícula	

Desenvolvedor Júnior

Tecnologia

	Ativo	Ver Perfil

M

Maria

CPF: 4269988455
	Sem matrícula	

Analista de RH

Administrativo

	Ativo	Ver Perfil

T

Thais Santos do Nascimento França

CPF: 48863074555
	Sem matrícula	

Desenvolvedor Júnior

Tecnologia

	Ativo	Ver Perfil

C

Carlos

CPF: 45566888755
	Sem matrícula	

Diretor de Tecnologia

Tecnologia

	Ativo	Ver Perfil
```

## Rubricas Cadastradas
```
Motor de Rubricas

Configure os eventos e regras matemáticas da folha de pagamento.

Nova Rubrica
CÓDIGO / RUBRICA	NATUREZA (TIPO)	REGRA DE CÁLCULO	ORDEM	INCIDÊNCIAS

1001

Salário Base

SALARY • AUTOMATICA

	PROVENTO (+)	
Valor Fixo
	
1
	
INSS
IRRF
FGTS


1010

Horas Extras 50%

OVERTIME • MANUAL

	PROVENTO (+)	
Valor Fixo
	
10
	
INSS
IRRF
FGTS


1011

DSR sobre Horas Extras

SALARY • AUTOMATICA

	PROVENTO (+)	
Valor Fixo
	
25
	
INSS
IRRF
FGTS


2001

INSS

TAX • AUTOMATICA

	DESCONTO (-)	
Tabela Ref.
	
50
	


2002

IRPF

TAX • AUTOMATICA

	DESCONTO (-)	
Tabela Ref.
	
60
	


2003

Vale Transporte

BENEFIT • AUTOMATICA

	DESCONTO (-)	
Valor Fixo
	
40
	


2004

Faltas Injustificadas

OTHER • MANUAL

	DESCONTO (-)	
Valor Fixo
	
15
	


2005

FGTS Mensal

TAX • AUTOMATICA

	BASE CÁLC. (=)	
Valor Fixo
	
70
	


2006

Vale Compras - Mercado

BENEFIT • MANUAL

	DESCONTO (-)	
Valor Fixo
	
41
	


2007

Vale Compras - Atacado

BENEFIT • MANUAL

	DESCONTO (-)	
Valor Fixo
	
42
	


2008

Vale Compras - Restaurante

BENEFIT • MANUAL

	DESCONTO (-)	
Valor Fixo
	
43
	


2009

Empréstimo

SALARY • MANUAL

	DESCONTO (-)	
Valor Fixo
	
80
	


301

Adiantamento Quinzenal

ADVANCE • MANUAL

	PROVENTO (+)	
Valor Fixo
	
5
	
```

## Lançamentos Variáveis e Descontos
```
Lançamentos Variáveis
Competências
Set/2026
Adiantamento
Set/2026
Mensal
Novo Lançamento
COLABORADOR	RUBRICA / EVENTO	ORIGEM	QUANT. / REF.	VALOR (R$)	AÇÕES


Nenhum evento lançado nesta competência.

Os cálculos automáticos não aparecem aqui, apenas as variáveis inseridas.
```

## Resultados do Cálculo (Motor de Folha)
```
Lançamentos Variáveis
Competências
Set/2026
Adiantamento
Set/2026
Mensal
Novo Lançamento
COLABORADOR	RUBRICA / EVENTO	ORIGEM	QUANT. / REF.	VALOR (R$)	AÇÕES


Nenhum evento lançado nesta competência.

Os cálculos automáticos não aparecem aqui, apenas as variáveis inseridas.
```

