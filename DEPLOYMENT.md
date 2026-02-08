# 🚀 프로덕션 배포 가이드

## 배포 전 체크리스트

### 1. 환경 변수 설정 (Vercel)

다음 환경 변수들이 **Production** 환경에 설정되어 있는지 확인하세요:

#### 필수 환경 변수
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anon Key
- `ANTHROPIC_API_KEY` - Anthropic Claude API Key
- `OPENAI_API_KEY` - OpenAI API Key
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - VAPID 공개 키 (푸시 알림용)
- `VAPID_PRIVATE_KEY` - VAPID 개인 키 (푸시 알림용)

#### 선택적 환경 변수
- `NEXT_PUBLIC_APP_URL` - 앱 URL (기본값: `https://dr-docent.vercel.app`)
- `ANTHROPIC_MODEL` - Claude 모델 ID (기본값: `claude-haiku-4-5-20251001`). `claude-3-5-haiku-latest`는 deprecated되어 404 발생 시 이 값을 확인하세요.

### 2. 환경 변수 체크

로컬에서 환경 변수를 체크하려면:
```bash
npm run check-env
```

### 3. 빌드 테스트

배포 전 로컬에서 빌드 테스트:
```bash
npm run build
```

### 4. Supabase 설정 확인

1. **RLS 정책 확인**
   - `supabase/fix-rls-policies.sql` 실행 완료 확인
   - `health_logs`, `cycle_logs`, `schedules`, `push_subscriptions` 테이블 RLS 활성화 확인

2. **테이블 생성 확인**
   - `supabase/schema-v2.sql` 실행 완료 확인
   - 모든 테이블이 정상적으로 생성되었는지 확인

### 5. PWA 설정 확인

- `public/manifest.json` - 상대 경로만 사용 (✅ 확인됨)
- `public/sw.js` - 하드코딩된 도메인 없음 (✅ 확인됨)
- Service Worker 검증:
  ```bash
  npm run verify-sw
  ```
- 아이콘 파일 존재 확인:
  - `/public/icon-192x192.png`
  - `/public/icon-512x512.png`
  - `/public/badge-72x72.png` (선택적)

#### Service Worker 주요 개선사항 (v2)
- ✅ 리다이렉트 모드 충돌 해결 (`redirect: 'follow'`)
- ✅ 캐시 버전 업데이트 (v1 → v2, 강제 갱신)
- ✅ API 요청 완전 제외 처리
- ✅ 에러 핸들링 강화
- ✅ 오프라인 지원 개선

### 6. 배포 후 확인 사항

1. **기본 기능 테스트**
   - [ ] 로그인/로그아웃
   - [ ] 대시보드 로드
   - [ ] 건강 기록 버튼 (식사/운동/복약)
   - [ ] 캘린더 뷰
   - [ ] AI 채팅

2. **PWA 기능 테스트**
   - [ ] Service Worker 등록
   - [ ] 푸시 알림 권한 요청
   - [ ] 오프라인 동작

3. **에러 모니터링**
   - Vercel 로그 확인
   - 브라우저 콘솔 에러 확인

## 배포 명령어

```bash
# 1. 환경 변수 체크
npm run check-env

# 2. 빌드 테스트
npm run build

# 3. Git 커밋 및 푸시
git add .
git commit -m "chore: 프로덕션 배포 준비"
git push origin main

# 4. Vercel 자동 배포 확인
# Vercel이 자동으로 main 브랜치 변경을 감지하여 배포합니다
```

## 문제 해결

### 빌드 에러
- TypeScript 타입 에러: `npm run build` 실행하여 확인
- 환경 변수 누락: `npm run check-env` 실행하여 확인

### 런타임 에러
- Vercel 로그에서 `requestId`로 검색
- 브라우저 콘솔 에러 확인
- Supabase RLS 정책 확인

### 푸시 알림 미작동
- VAPID 키가 올바르게 설정되었는지 확인
- Service Worker 등록 확인 (브라우저 개발자 도구)
- 알림 권한이 허용되었는지 확인
