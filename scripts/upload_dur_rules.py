"""
DUR 규칙 CSV → Supabase dur_rules 테이블 업로드
================================================
- scripts/ 폴더의 모든 UTF-8 CSV를 순회
- 파일명(확장자 제외) → dur_type 자동 할당
- 카테고리별 detail 컬럼 → restriction_reason 통합
- 1,000건 배치 upsert (item_seq + dur_type 기준)
- 실행 시 테이블의 실제 컬럼을 자동 조회 → 없는 컬럼은 필터링

사전 준비:
  pip install pandas supabase python-dotenv

실행:
  python3 scripts/upload_dur_rules.py
"""

import os
import re
import math
import sys
import unicodedata
import urllib.request
import json
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# ── 환경변수 로드 ──────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ .env.local 에서 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 찾을 수 없습니다.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── 설정 ───────────────────────────────────────────────────────
SCRIPTS_DIR  = Path(__file__).resolve().parent
BATCH_SIZE   = 1000
TABLE_NAME   = "dur_rules"

# ── 전체 컬럼 정의 (업로드하고 싶은 최종 목표 스키마) ──────────
ALL_TARGET_COLS = {
    "dur_type", "item_seq", "item_name", "ingr_name", "ingr_name_raw",
    "ingr_code", "company_name", "reimbursement", "notice_no", "notice_date",
    "restriction_reason", "age_limit_value", "age_limit_unit", "age_limit_condition",
    "preg_grade", "max_daily_dose_mg", "max_dosage_days",
    "therapeutic_group", "group_classification",
}

# ALTER TABLE 구문 템플릿 (컬럼명 → SQL)
_ALTER_TEMPLATES: dict[str, str] = {
    "ingr_name_raw":        "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS ingr_name_raw        TEXT;",
    "ingr_code":            "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS ingr_code            TEXT;",
    "company_name":         "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS company_name         TEXT;",
    "reimbursement":        "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS reimbursement        TEXT;",
    "notice_no":            "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS notice_no            TEXT;",
    "notice_date":          "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS notice_date          TEXT;",
    "age_limit_value":      "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS age_limit_value      TEXT;",
    "age_limit_unit":       "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS age_limit_unit       TEXT;",
    "age_limit_condition":  "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS age_limit_condition  TEXT;",
    "preg_grade":           "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS preg_grade           TEXT;",
    "max_daily_dose_mg":    "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS max_daily_dose_mg    TEXT;",
    "max_dosage_days":      "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS max_dosage_days      TEXT;",
    "therapeutic_group":    "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS therapeutic_group    TEXT;",
    "group_classification": "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS group_classification TEXT;",
    "updated_at":           "ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT NOW();",
}
_UNIQUE_SQL = (
    "DO $$ BEGIN\n"
    "  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='dur_rules_uq'"
    " AND conrelid='dur_rules'::regclass) THEN\n"
    "    ALTER TABLE dur_rules ADD CONSTRAINT dur_rules_uq UNIQUE (item_seq, dur_type);\n"
    "  END IF;\n"
    "END$$;"
)


def fetch_table_columns() -> set[str]:
    """PostgREST OpenAPI로 dur_rules 실제 컬럼 목록 조회"""
    url = f"{SUPABASE_URL}/rest/v1/"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Accept": "application/openapi+json",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    props = data.get("definitions", {}).get(TABLE_NAME, {}).get("properties", {})
    return set(props.keys())


def preflight_check() -> set[str]:
    """
    테이블 실제 컬럼 확인 → 누락 컬럼 출력 + ALTER SQL 안내
    반환값: 현재 업로드 가능한 컬럼 집합
    """
    print("🔍 dur_rules 테이블 스키마 확인 중...")
    try:
        existing = fetch_table_columns()
    except Exception as e:
        print(f"⚠️  스키마 조회 실패 ({e}) — 업로드 가능 컬럼 자동 확인 불가. 계속 진행합니다.")
        return ALL_TARGET_COLS

    available = ALL_TARGET_COLS & existing
    missing   = ALL_TARGET_COLS - existing

    print(f"  현재 컬럼: {len(existing)}개  |  업로드 가능: {len(available)}개  |  누락: {len(missing)}개")

    if missing:
        missing_data_cols = missing - {"dur_type"}  # dur_type은 코드에서 채움
        if missing_data_cols:
            print("\n" + "─" * 60)
            print("⚠️  아래 컬럼이 테이블에 없어 해당 데이터는 건너뜁니다.")
            print("   Supabase Dashboard → SQL Editor에서 아래 SQL을 실행하면 모든 데이터를 올릴 수 있습니다:\n")
            for col in sorted(missing_data_cols):
                if col in _ALTER_TEMPLATES:
                    print(f"   {_ALTER_TEMPLATES[col]}")
            # UNIQUE 제약 여부 확인
            if "dur_rules_uq" not in str(existing):
                print(f"\n   {_UNIQUE_SQL}")
            print("─" * 60 + "\n")

    return available

# ── 파일명 → clean dur_type: 키워드 기반 매핑 ─────────────────
# 파일명 stem에서 핵심 한글 키워드를 추출해 간결한 dur_type 생성
_KEYWORD_MAP: list[tuple[str, str]] = [
    ("임부금기",    "임부금기"),
    ("노인금기",    "노인금기"),
    ("노인주의",    "노인주의"),
    ("어린이주의",  "어린이주의"),
    ("연령금기",    "연령금기"),
    ("용량주의",    "용량주의"),
    ("지속기간주의","지속기간주의"),
    ("효능군중복",  "효능군중복"),
]

def get_dur_type(stem: str) -> str:
    """파일명 stem → dur_type (NFC 정규화 후 핵심 키워드 추출)"""
    # macOS는 파일명을 NFD로 저장하므로 NFC로 변환 후 비교
    s = unicodedata.normalize("NFC", stem.strip())

    for keyword, label in _KEYWORD_MAP:
        if keyword in s:
            suffix = "_DUR" if "DUR" in s else ("2" if "약물2" in s or "2 (" in s or s.endswith("2") else "")
            return label + suffix

    return re.sub(r"[^\w가-힣]", "_", s).strip("_")[:30]


# ── 카테고리별 컬럼 → dur_rules 필드 매핑 ─────────────────────
# 각 파일의 고유 컬럼을 dur_rules 공통 스키마로 변환
COLUMN_MAP: dict[str, str] = {
    # 공통
    "item_seq":                    "item_seq",
    "item_name":                   "item_name",
    "main_ingr_name":              "ingr_name",
    "main_ingr_name_raw":          "ingr_name_raw",
    "ingr_code":                   "ingr_code",
    "company_name":                "company_name",
    "reimbursement":               "reimbursement",
    "notice_no":                   "notice_no",
    "notice_date":                 "notice_date",

    # 상세 사유 (카테고리마다 이름이 달라 restriction_reason으로 통합)
    "age_contraindication_detail": "restriction_reason",
    "prohibited_detail":           "restriction_reason",
    "caution_detail":              "restriction_reason",
    "child_caution_detail":        "restriction_reason",
    "preg_contraindication_detail":"restriction_reason",
    "max_daily_dose_desc":         "restriction_reason",  # 용량주의 — 설명을 reason으로

    # 연령 관련
    "age_limit_value":             "age_limit_value",
    "age_limit_unit":              "age_limit_unit",
    "age_limit_condition":         "age_limit_condition",

    # 임부금기 등급
    "preg_contraindication_grade": "preg_grade",

    # 용량주의 수치
    "max_daily_dose_mg":           "max_daily_dose_mg",

    # 지속기간주의
    "max_dosage_days":             "max_dosage_days",

    # 효능군 중복
    "therapeutic_group":           "therapeutic_group",
    "group_classification":        "group_classification",
}


def read_csv_safe(path: Path) -> pd.DataFrame:
    """UTF-8 → CP949 순으로 fallback 하여 CSV 읽기"""
    for enc in ("utf-8", "cp949", "euc-kr"):
        try:
            df = pd.read_csv(path, dtype=str, encoding=enc, keep_default_na=False)
            return df
        except (UnicodeDecodeError, LookupError):
            continue
    raise ValueError(f"지원하는 인코딩으로 읽을 수 없음: {path.name}")


def build_records(df: pd.DataFrame, dur_type: str, allowed_cols: set[str]) -> list[dict]:
    """DataFrame → dur_rules 레코드 리스트 변환 (allowed_cols에 있는 컬럼만 포함)"""
    records = []

    for _, row in df.iterrows():
        rec: dict = {"dur_type": dur_type}

        # restriction_reason 충돌 방지: 여러 detail 컬럼이 있을 경우 앞쪽 우선
        reason_set = False

        for csv_col, db_col in COLUMN_MAP.items():
            if csv_col not in df.columns:
                continue
            if db_col not in allowed_cols:  # 테이블에 없는 컬럼은 건너뜀
                continue
            val = row[csv_col].strip() if isinstance(row[csv_col], str) else ""
            if not val:
                continue

            if db_col == "restriction_reason":
                if not reason_set:
                    rec["restriction_reason"] = val
                    reason_set = True
            else:
                rec[db_col] = val

        # item_seq 없으면 스킵
        if not rec.get("item_seq"):
            continue

        records.append(rec)

    return records


def check_unique_constraint() -> bool:
    """dur_rules_uq UNIQUE 제약 존재 여부 확인"""
    try:
        # upsert 1건으로 제약 존재 여부 테스트
        test = [{"item_seq": "__test__", "dur_type": "__test__", "item_name": "test"}]
        supabase.table(TABLE_NAME).upsert(test, on_conflict="item_seq,dur_type").execute()
        # 테스트 행 삭제
        supabase.table(TABLE_NAME).delete().eq("item_seq", "__test__").execute()
        return True
    except Exception as e:
        return "42P10" not in str(e)  # 42P10 이외 오류면 제약은 있는 것


def upload_batch(records: list[dict], use_upsert: bool = True) -> int:
    """1,000건 단위 업로드 → 성공 건수 반환
    use_upsert=True : UNIQUE 제약 있을 때 upsert (ON CONFLICT UPDATE)
    use_upsert=False: 제약 없을 때 INSERT (최초 1회 적재용)
    """
    if not records:
        return 0

    if use_upsert:
        resp = (
            supabase.table(TABLE_NAME)
            .upsert(records, on_conflict="item_seq,dur_type")
            .execute()
        )
    else:
        resp = (
            supabase.table(TABLE_NAME)
            .insert(records)
            .execute()
        )

    return len(resp.data) if resp.data else len(records)


def process_file(path: Path, allowed_cols: set[str], use_upsert: bool) -> tuple[int, int]:
    """단일 CSV 처리 → (시도 건수, 성공 건수) 반환"""
    stem = path.stem
    dur_type = get_dur_type(stem)

    try:
        df = read_csv_safe(path)
    except Exception as e:
        print(f"  ❌ 읽기 실패: {e}")
        return 0, 0

    records = build_records(df, dur_type, allowed_cols)
    total = len(records)
    if total == 0:
        print(f"  ⚠️  유효 레코드 없음 — 건너뜀")
        return 0, 0

    batches = math.ceil(total / BATCH_SIZE)
    uploaded = 0

    for i in range(batches):
        chunk = records[i * BATCH_SIZE : (i + 1) * BATCH_SIZE]
        try:
            n = upload_batch(chunk, use_upsert=use_upsert)
            uploaded += n
            print(f"  배치 {i+1}/{batches}  {uploaded:,}/{total:,}건 완료")
        except Exception as e:
            print(f"  ❌ 배치 {i+1} 업로드 오류: {e}")

    return total, uploaded


def main():
    csv_files = sorted(
        p for p in SCRIPTS_DIR.glob("*.csv")
        if not p.name.endswith(".bak")
    )

    if not csv_files:
        print("CSV 파일이 없습니다.")
        sys.exit(0)

    # ── 실행 전 테이블 스키마 확인 ─────────────────────────────
    allowed_cols = preflight_check()

    # upsert 기준 컬럼 확인
    has_unique = "item_seq" in allowed_cols and "dur_type" in allowed_cols
    if not has_unique:
        print("❌ item_seq 또는 dur_type 컬럼이 없습니다. 테이블 구조를 확인하세요.")
        sys.exit(1)

    # ── UNIQUE 제약 존재 여부 확인 → upsert / insert 선택 ──────
    print("🔍 UNIQUE 제약(dur_rules_uq) 확인 중...")
    use_upsert = check_unique_constraint()
    if use_upsert:
        print("  ✅ UNIQUE 제약 확인 — upsert 모드로 실행\n")
    else:
        print("  ⚠️  UNIQUE 제약 없음 — INSERT 모드로 실행 (중복 방지 없음)")
        print("     재실행 시 중복이 발생할 수 있습니다.")
        print("     아래 SQL을 Supabase SQL Editor에서 실행 후 재업로드하면 안전합니다:")
        print(f"\n   {_UNIQUE_SQL}\n")

    print(f"대상 파일: {len(csv_files)}개\n{'='*60}")

    grand_total = 0
    grand_uploaded = 0

    for path in csv_files:
        stem = path.stem
        dur_type = get_dur_type(stem)
        print(f"\n📄 {path.name}")
        print(f"   dur_type: {dur_type}")

        total, uploaded = process_file(path, allowed_cols, use_upsert)
        grand_total    += total
        grand_uploaded += uploaded

        status = "✅" if uploaded == total else "⚠️ "
        print(f"   {status} {uploaded:,} / {total:,}건 업로드")

    print(f"\n{'='*60}")
    print(f"[전체 완료]  파일: {len(csv_files)}개")
    print(f"  시도: {grand_total:,}건  /  성공: {grand_uploaded:,}건")
    if grand_total > grand_uploaded:
        print(f"  ⚠️  실패: {grand_total - grand_uploaded:,}건 — 위 오류 메시지를 확인하세요.")


if __name__ == "__main__":
    main()
