alter table public.categories
add column if not exists icon text not null default 'shopping-basket';
