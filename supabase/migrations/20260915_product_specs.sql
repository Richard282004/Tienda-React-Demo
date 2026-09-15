alter table products
  add column if not exists weight text,
  add column if not exists dimensions text,
  add column if not exists material text,
  add column if not exists technique text,
  add column if not exists care text,
  add column if not exists additional_details text;
