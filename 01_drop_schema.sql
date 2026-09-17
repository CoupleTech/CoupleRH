-- AVISO: ISSO VAI APAGAR TODAS AS TABELAS DO SEU BANCO DE DADOS ATUAL
-- Rode isso apenas se tiver certeza de que este é o "banco novo" e você quer recriá-lo limpo

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
