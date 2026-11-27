-- Adiciona layouts HTML personalizados aos comunicados existentes.
-- Execute uma vez no mesmo banco da API após a migration 2026-11-26-comunicados.sql.

ALTER TABLE `broadcasts`
  ADD COLUMN `customHtml` MEDIUMTEXT NULL AFTER `ctaUrl`;
