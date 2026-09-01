create table if not exists public.problems (
  id bigint generated always as identity primary key,
  code text not null unique,
  subject text not null,
  unit text not null,
  problem_type text not null,
  difficulty text not null check (difficulty in ('쉬움', '보통', '응용')),
  question text not null,
  hint text not null,
  answer text not null,
  explanation text not null,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.problems enable row level security;

revoke all on table public.problems from anon, authenticated;
grant select on table public.problems to anon, authenticated;

drop policy if exists "누구나 활성 문제 읽기" on public.problems;
create policy "누구나 활성 문제 읽기"
on public.problems
for select
to anon, authenticated
using (is_active = true);

insert into public.problems
  (code, subject, unit, problem_type, difficulty, question, hint, answer, explanation, tags)
values
  ('math-quadratic-001', '수학', '이차방정식', '계산형', '쉬움',
   '방정식 x² - 5x + 6 = 0을 풀어라.',
   '곱해서 6, 더해서 -5가 되는 두 수를 찾아 인수분해해 보세요.',
   'x = 2 또는 x = 3',
   '(x - 2)(x - 3) = 0이므로 x = 2 또는 x = 3이다.',
   array['인수분해', '근']),
  ('math-quadratic-002', '수학', '이차방정식', '계산형', '보통',
   '방정식 2x² - 7x + 3 = 0을 풀어라.',
   '인수분해가 어렵다면 근의 공식을 사용해 보세요.',
   'x = 1/2 또는 x = 3',
   '(2x - 1)(x - 3) = 0이므로 x = 1/2 또는 x = 3이다.',
   array['인수분해', '근의 공식']),
  ('math-quadratic-003', '수학', '이차방정식', '활용형', '응용',
   '연속한 두 자연수의 곱이 72일 때 두 자연수를 구하여라.',
   '작은 자연수를 x로 놓고 x(x + 1) = 72인 이차방정식을 만드세요.',
   '8과 9',
   'x² + x - 72 = 0을 인수분해하면 (x + 9)(x - 8) = 0이다. 자연수 조건에 따라 x = 8이므로 두 수는 8과 9이다.',
   array['활용', '식 세우기'])
on conflict (code) do nothing;
