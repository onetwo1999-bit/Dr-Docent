# 로그인 시 "사이트에 연결할 수 없음" / DNS_PROBE_FINISHED_BAD_CONFIG

## 원인

로그인 버튼을 누르면 앱이 **Supabase 인증 서버**(`*.supabase.co`)로 리다이렉트됩니다.  
이때 브라우저가 **Supabase 도메인의 IP 주소를 찾지 못하면** 아래와 같은 화면이 나옵니다.

- **메시지:** `fddoizheudxxqescjpbq.supabase.co의 서버 IP 주소를 찾을 수 없습니다`
- **에러 코드:** `DNS_PROBE_FINISHED_BAD_CONFIG`

즉, **DNS 조회 실패** 또는 **네트워크/환경 문제**로 Supabase에 연결되지 않는 상황입니다.

---

## 해결 방법 (순서대로 시도)

### 1. 환경 변수 확인

`.env.local`에 Supabase URL이 **Supabase 대시보드와 동일한지** 확인하세요.

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 선택
2. **Settings → API** 에서 **Project URL** 복사
3. `.env.local` 예시:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
4. URL 오타, `http`/`https` 혼동, 앞뒤 공백이 없는지 확인
5. **서버/개발 서버 재시작** (`npm run dev` 다시 실행)

---

### 2. Supabase 프로젝트 상태 확인

- 무료 플랜은 **일정 기간 미사용 시 프로젝트가 일시 정지**됩니다.
- 대시보드에서 해당 프로젝트가 **Paused**가 아닌지 확인하고, 필요하면 **Restore** 하세요.
- 프로젝트를 삭제했다면 같은 URL은 더 이상 동작하지 않습니다. 새 프로젝트 URL로 `.env.local`을 수정해야 합니다.

---

### 3. DNS / 네트워크 조회

로컬에서 Supabase 도메인이 조회되는지 확인합니다.

**터미널에서:**

```bash
# Supabase 도메인 조회 테스트 (프로젝트 URL의 호스트로 바꿔서 실행)
ping fddoizheudxxqescjpbq.supabase.co
# 또는
nslookup fddoizheudxxqescjpbq.supabase.co
```

- **조회가 안 되면:** PC/노트북의 DNS 또는 네트워크 문제 가능성이 큽니다.
- **조회가 되면:** 브라우저/프록시/방화벽만 의심해 보면 됩니다.

---

### 4. DNS 설정 변경 (PC/노트북)

다른 DNS로 바꿔서 테스트해 보세요.

- **Mac:** 시스템 설정 → 네트워크 → 사용 중인 연결(Wi‑Fi/이더넷) → 세부사항 → DNS  
  - 예: `8.8.8.8`, `8.8.4.4` (Google) 또는 `1.1.1.1` (Cloudflare) 추가
- **Windows:** 제어판 → 네트워크 및 공유 센터 → 어댑터 설정 변경 → 해당 연결 속성 → IPv4 → DNS 서버 주소에 위와 같이 입력

변경 후 **브라우저 완전 종료 후 재실행**하고 로그인 다시 시도.

---

### 5. VPN / 방화벽 / 프록시

- **VPN**을 켜 둔 상태라면 **끄고** 다시 로그인 시도.
- **회사/학교/공용 Wi‑Fi**에서는 Supabase 도메인이 차단될 수 있습니다. **다른 네트워크(예: 휴대폰 핫스팟)**에서 시도해 보세요.
- **프록시**를 쓰는 경우, `*.supabase.co`가 차단 목록에 없는지 확인.

---

### 6. 브라우저 캐시 / 시크릿 모드

- **시크릿(프라이빗) 창**에서 같은 주소로 접속 후 로그인 시도.
- 또는 **캐시 삭제** 후 다시 시도.

---

## 정리

| 증상 | 가능한 원인 | 우선 확인 |
|------|-------------|-----------|
| `서버 IP 주소를 찾을 수 없습니다` | DNS 조회 실패 | 환경 변수 URL, Supabase 프로젝트 상태, DNS 설정 |
| 같은 네트워크에서만 안 됨 | 해당 네트워크에서 Supabase 차단 | VPN 끄기, 다른 네트워크에서 시도 |
| 다른 사이트는 되는데 Supabase만 안 됨 | DNS/프록시가 supabase.co만 막음 | DNS를 8.8.8.8 등으로 변경, 프록시 확인 |

위 단계를 해도 동일하면, **다른 네트워크(휴대폰 핫스팟 등)**와 **다른 PC/브라우저**에서도 같은지 확인해 보시면 원인 범위를 좁히는 데 도움이 됩니다.
