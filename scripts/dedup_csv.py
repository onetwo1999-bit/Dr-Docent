"""
CSV 파일 ITEM_SEQ 기준 중복 제거 스크립트 (Pandas)
=====================================================
- ITEM_SEQ가 동일한 행 중 마지막(last) 데이터만 유지
- 중복 제거 전/후 행 수 차이 출력
- 원본은 .bak 으로 백업 후 덮어쓰기

사용법:
  단일 파일:   python3 dedup_csv.py 파일.csv
  여러 파일:   python3 dedup_csv.py 파일1.csv 파일2.csv
  폴더 전체:   python3 dedup_csv.py --all
"""

import sys
import glob
import shutil
from pathlib import Path

import pandas as pd


DEDUP_COL = "item_seq"


def dedup_file(path: Path) -> None:
    print(f"\n{'─'*60}")
    print(f"파일: {path.name}")

    # ── 읽기 ─────────────────────────────────────────────────
    try:
        df = pd.read_csv(path, dtype=str, keep_default_na=False)
    except Exception as e:
        print(f"  ❌ 읽기 실패: {e}")
        return

    if DEDUP_COL not in df.columns:
        print(f"  ⚠️  '{DEDUP_COL}' 컬럼 없음 — 건너뜀")
        return

    before = len(df)

    # ── 중복 제거: ITEM_SEQ 동일 → 마지막 행 유지 ────────────
    df_dedup = df.drop_duplicates(subset=DEDUP_COL, keep="last").reset_index(drop=True)

    after  = len(df_dedup)
    removed = before - after

    print(f"  중복 제거 전: {before:,}건")
    print(f"  중복 제거 후: {after:,}건")
    print(f"  제거된 행수: {removed:,}건  ({removed/before*100:.1f}%)" if before else "  데이터 없음")

    if removed == 0:
        print("  ✅ 중복 없음 — 파일 변경 없음")
        return

    # ── 원본 백업 (.bak) ──────────────────────────────────────
    bak = path.with_suffix(".csv.bak")
    shutil.copy2(path, bak)
    print(f"  📦 원본 백업: {bak.name}")

    # ── 저장 (UTF-8, 따옴표 전체 감싸기) ──────────────────────
    df_dedup.to_csv(path, index=False, encoding="utf-8", quoting=1)  # QUOTE_ALL
    print(f"  ✅ 저장 완료: {path.name}")


def main():
    args = sys.argv[1:]

    if not args:
        print("사용법:")
        print("  단일 파일:  python3 dedup_csv.py 파일.csv")
        print("  여러 파일:  python3 dedup_csv.py 파일1.csv 파일2.csv")
        print("  폴더 전체:  python3 dedup_csv.py --all")
        sys.exit(0)

    if args == ["--all"]:
        # 현재 스크립트와 같은 디렉터리의 모든 CSV 대상 (백업 파일 제외)
        script_dir = Path(__file__).parent
        targets = sorted(
            p for p in script_dir.glob("*.csv")
            if not p.name.endswith(".bak")
               and p.name != Path(__file__).name
        )
        if not targets:
            print("CSV 파일이 없습니다.")
            sys.exit(0)
    else:
        targets = [Path(a) for a in args]

    total_before = 0
    total_after  = 0

    for p in targets:
        if not p.exists():
            print(f"\n❌ 파일 없음: {p}")
            continue

        # 개수 집계용 임시 읽기
        try:
            df_tmp = pd.read_csv(p, dtype=str, keep_default_na=False)
            b = len(df_tmp)
        except Exception:
            b = 0

        dedup_file(p)

        try:
            df_after = pd.read_csv(p, dtype=str, keep_default_na=False)
            a = len(df_after)
        except Exception:
            a = b

        total_before += b
        total_after  += a

    if len(targets) > 1:
        print(f"\n{'='*60}")
        print(f"[전체 합계]  처리 파일: {len(targets)}개")
        print(f"  중복 제거 전 총계: {total_before:,}건")
        print(f"  중복 제거 후 총계: {total_after:,}건")
        print(f"  총 제거된 행수:    {total_before - total_after:,}건")


if __name__ == "__main__":
    main()
