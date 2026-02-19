# Vercel 환경 변수 체크리스트 (Chat API / 의약품 RAG)

로그에 `SUPABASE_SERVICE_ROLE_KEY`, `MFDS_DRUG_INFO_API_KEY`가 **(undefined)** 로 나오는 경우,  
**Vercel이 해당 키를 주입하지 않은 것**입니다. 코드가 아니라 대시보드 설정을 확인하세요.

**참고:** 이 프로젝트는 `next.config.ts`의 `env` 블록으로 위 두 키를 **빌드 시점**에 연결합니다.  
Vercel에서 해당 변수가 **Build 시에도** 사용 가능해야 합니다 (Settings → Environment Variables에서 제한이 없다면 Build·Runtime 모두 사용 가능).

## 확인 순서

### 1. 환경 변수 존재 여부

- [ ] [Vercel Dashboard](https://vercel.com) → 해당 프로젝트 선택
- [ ] **Settings** → **Environment Variables**
- [ ] 아래 두 이름이 **정확히** 있는지 확인 (대소문자·밑줄만, 띄어쓰기 없음)
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `MFDS_DRUG_INFO_API_KEY`

### 2. 적용 환경(Environment) 체크

각 변수 행에서 **어디에 적용되는지** 확인:

- [ ] **Production** – 프로덕션 URL로 접속 시 사용. 여기 체크가 없으면 프로덕션에서 `undefined`.
- [ ] **Preview** – PR/브랜치 배포에서만 필요하면 체크.
- [ ] **Development** – 로컬 `vercel dev`용.

**지금 프로덕션(메인 도메인)에서 채팅을 쓰고 있다면, 반드시 Production에 체크가 있어야 합니다.**

### 3. 저장 후 재배포

- [ ] 변수 추가/수정 후 **Save** 클릭
- [ ] **Deployments** 탭 → 최신 배포 선택 → **⋮** → **Redeploy**
- [ ] 필요하면 **Redeploy with existing Build Cache** 해제 후 재배포

새 배포가 끝난 뒤에야 런타임에 새 환경 변수가 반영됩니다.

### 4. 이름 오타 확인

| 올바른 이름 (복사용)        | 잘못된 예 |
|----------------------------|-----------|
| `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY ` (끝 공백), `Supabase_Service_Role_Key` |
| `MFDS_DRUG_INFO_API_KEY`    | `MFDS_DRUG_INFO_API_KEY ` (끝 공백), `MFDS_DRUG_INFO_AP_KEY` |

Value는 **Encrypted**로 표시되면 정상입니다. 키 **이름**이 위와 완전히 일치하는지만 확인하면 됩니다.

---

## 로그로 확인하는 방법

배포 후 채팅 한 번 보내고, Vercel 로그에서 다음을 확인:

- `VERCEL ENV KEYS ALL` 목록에 `SUPABASE_SERVICE_ROLE_KEY`, `MFDS_DRUG_INFO_API_KEY`가 **포함**되어 있는지
- `Supabase ServiceRole: OK`, `MFDS_DRUG_INFO_API_KEY: OK` 로 나오는지

둘 다 OK면 해당 요청에서는 환경 변수가 정상 주입된 것입니다.
