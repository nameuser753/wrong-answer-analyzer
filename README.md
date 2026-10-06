# 오답 탐정

정보과학 프로젝트 2회차용 오답 등록 화면입니다.

## 실행 방법

이 버전은 API 키를 안전하게 보호하기 위해 서버를 통해 실행합니다.

1. [OpenAI API 키 페이지](https://platform.openai.com/api-keys)에서 API 키를 만듭니다.
2. `.env.example`을 복사해 이름을 `.env`로 바꿉니다.
3. `.env`의 `OPENAI_API_KEY=` 뒤에 발급받은 키를 입력합니다.
4. 이 폴더에서 아래 명령을 실행합니다.

```powershell
node server.mjs
```

5. 브라우저에서 `http://127.0.0.1:4173`을 엽니다.

> `.env` 파일은 `.gitignore`에 포함되어 있으므로 GitHub에 업로드되지 않습니다. API 키를 `script.js`나 GitHub 파일에 직접 적지 마세요.

## 이번 회차 구현 내용

- 과목, 단원, 문제 유형 입력
- 문제 이미지 선택
- 내가 쓴 답과 정답 입력
- 문제를 풀 당시의 상황 선택
- `오답 분석하기` 버튼을 누르면 입력 결과 표시
- GPT가 입력한 답안과 문제 이미지를 함께 분석
- AI가 오답 원인, 판단 이유, 확인할 개념, 다음 학습 행동 표시
- GPT 분석 결과와 가까운 공개 문제 3개를 Supabase에서 검색해 추천
- 오답 입력, 분석 결과, 추천 문제를 각각 독립된 화면으로 전환
- 추천 문제의 힌트와 정답·해설을 별도 버튼으로 확인

## Supabase 문제 데이터베이스 준비

1. Supabase에서 새 프로젝트를 만듭니다.
2. 프로젝트의 SQL Editor를 열고 `supabase-schema.sql` 전체를 실행합니다.
3. Project Settings의 API 화면에서 Project URL과 Publishable key를 확인합니다.
4. `.env`에 아래 두 항목을 추가합니다.

```text
SUPABASE_URL=https://프로젝트ID.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_실제키
```

`supabase-schema.sql`은 `problems` 테이블, 읽기 전용 RLS 정책, 테스트용 이차방정식 문제 3개를 만듭니다. 서버는 GPT가 반환한 취약 개념과 검색어를 이용해 이 테이블의 문제를 채점하고 가장 가까운 3개를 고릅니다. GPT가 문제를 새로 생성하지 않습니다. Publishable key는 RLS와 함께 읽기 전용으로 사용하며, Secret key나 Service Role key는 브라우저에 노출하면 안 됩니다.

문제 출처를 추적하기 위해 `source_name`, `source_author`, `source_url`, `license`, `attribution` 열도 포함합니다. OER Commons 자료는 페이지마다 라이선스와 실제 제공자가 다르므로, CC BY 또는 퍼블릭 도메인으로 명확히 표시되고 문제 본문을 확인할 수 있는 자료만 가져와야 합니다. 현재 SQL에는 이 과정을 확인하기 위한 CC BY 벡터 문제 샘플 1개가 포함되어 있습니다.

## 공개 문제 데이터 100개

`data/oatutor-problems-ko.json`에는 OpenStax와 OATutor Project의 CC BY 4.0 대수 문제 100개를 한국어로 번역해 저장했습니다. 숫자, 수식, 변수와 정답은 원문을 유지했으며 새 문제를 생성하지 않았습니다. `data/oatutor-problems.sql`은 Supabase SQL Editor에서 실행할 수 있는 일괄 등록 파일입니다. 출처 표시 필드는 삭제하지 마세요.

데이터 재생성 도구는 `scripts` 폴더에 있습니다. 원문 추출, 한국어 번역, 단원명 정규화, Supabase SQL 생성 순서로 사용합니다.

OpenAI Responses API와 `gpt-5.4-mini`를 사용합니다. 분석 결과는 학습 보조용이며, 중요한 내용은 교과서나 선생님의 설명으로 다시 확인해야 합니다. 입력 내용은 현재 데이터베이스에 저장되지 않습니다.
