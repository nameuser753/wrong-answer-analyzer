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
  source_name text,
  source_author text,
  source_url text,
  license text,
  attribution text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 이미 테이블을 만든 뒤 이 파일을 다시 실행해도 출처 열이 추가됩니다.
alter table public.problems add column if not exists source_name text;
alter table public.problems add column if not exists source_author text;
alter table public.problems add column if not exists source_url text;
alter table public.problems add column if not exists license text;
alter table public.problems add column if not exists attribution text;

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

-- OER Commons에 등록된 CC BY 자료의 공개 예시를 한국어로 번역·문제화한 샘플입니다.
-- CC BY 조건에 따라 원저자, 원자료 주소, 라이선스를 함께 보존합니다.
insert into public.problems
  (code, subject, unit, problem_type, difficulty, question, hint, answer, explanation, tags,
   source_name, source_author, source_url, license, attribution)
values
  ('oer-vector-addition-001', '수학', '벡터', '계산형', '쉬움',
   '두 벡터 (2, 4)와 (1, 5)의 합을 구하여라.',
   '두 벡터의 같은 위치에 있는 성분끼리 더해 보세요.',
   '(3, 9)',
   '첫 번째 성분끼리 더하면 2 + 1 = 3이고, 두 번째 성분끼리 더하면 4 + 5 = 9이므로 합은 (3, 9)이다.',
   array['벡터', '벡터의 덧셈', 'OER'],
   'Adding vectors algebraically & graphically',
   'Salman Khan',
   'https://oercommons.org/courses/adding-vectors-algebraically-graphically',
   'CC BY',
   'Adapted and translated from “Adding vectors algebraically & graphically” by Salman Khan, available through OER Commons under CC BY.')
on conflict (code) do update set
  source_name = excluded.source_name,
  source_author = excluded.source_author,
  source_url = excluded.source_url,
  license = excluded.license,
  attribution = excluded.attribution;
