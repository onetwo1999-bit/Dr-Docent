import pandas as pd
from pathlib import Path


def convert_cp949_to_utf8(src: str) -> None:
    """cp949(EUC-KR) CSV → UTF-8-SIG CSV로 변환."""
    src_path = Path(src)
    dst_path = src_path.with_name(src_path.stem + "_utf8.csv")

    print(f"원본 파일: {src_path}")

    if not src_path.exists():
        print(f"⚠️ 파일이 존재하지 않습니다. 건너뜁니다: {src_path}")
        return

    print(f"변환 파일: {dst_path}")

    try:
        df = pd.read_csv(src_path, encoding="cp949")
        df.to_csv(dst_path, index=False, encoding="utf-8-sig")
        print("✅ 인코딩 변환 완료 (cp949 → utf-8-sig).")
    except Exception as e:
        print(f"🚨 변환 중 오류 발생: {e}")


def main():
    # 1) 세종특별자치시 체력 측정 내역
    convert_cp949_to_utf8(
        "/Users/jaysmac/Downloads/세종특별자치시_체력 측정 내역_20241231.csv"
    )

    # 2) 충청북도 청주시 굿충주헬스케어 체력평가 현황
    convert_cp949_to_utf8(
        "/Users/jaysmac/Downloads/충청북도 충주시_굿충주헬스케어 체력평가 현황_20240331.csv"
    )

    # 3) 한국건강증진개발원 모바일 헬스케어 운동
    convert_cp949_to_utf8(
        "/Users/jaysmac/Downloads/한국건강증진개발원_보건소 모바일 헬스케어 운동_20251120.csv"
    )

    # 4) 경기도 화성시 만성질환관리 프로그램 통계(운동)
    convert_cp949_to_utf8(
        "/Users/jaysmac/Downloads/경기도 화성시_만성질환관리 프로그램 통계(운동)_20191231.csv"
    )


if __name__ == "__main__":
    main()

