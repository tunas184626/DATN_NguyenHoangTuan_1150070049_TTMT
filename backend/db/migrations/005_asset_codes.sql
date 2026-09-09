create sequence if not exists asset_code_sequence;

alter table assets alter column asset_code set default (
  'TS-' || to_char(current_date, 'YYYYMM') || '-' || lpad(nextval('asset_code_sequence')::text, 6, '0')
);
