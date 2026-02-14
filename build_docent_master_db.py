"""
닥터 도슨트 전문 지식 엔진 — 운동 데이터 정제 및 전문 필드 추가

- 안전성 우선 상위 100종목 선별
- Biomechanical Rationale, Clinical Insight, Regression & Progression, Red Flags 추가
- CKC/OKC, TUT, Proprioception 데이터 포인트 포함
- docent_master_db.json 출력
"""

import json
import os
from pathlib import Path
from typing import Any, List, Optional

# ========== 설정 ==========
EXERCISE_FOLDER = Path("/Users/jaysmac/Downloads/운동루틴폴더")
OUTPUT_PATH = Path(__file__).resolve().parent / "docent_master_db.json"
TOP_N = 100

# ========== 근육군 → 임상적 통찰 매핑 (한국어) ==========
MUSCLE_CLINICAL_INSIGHT = {
    "quadriceps": "슬개대퇴통증증후군(PFPS), 슬관절 골관절염 환자에서 무릎 주위 근력 강화는 관절 안정성과 보행 기능 개선에 핵심적입니다.",
    "hamstrings": "허리 통증, 햄스트링 부상 재활 시 길항근 균형 회복이 중요합니다. 허리 굴곡 시 햄스트링이 길항근으로 작용해 척추를 보호합니다.",
    "calves": "발목 불안정성, 아킬레스건염 재활에서 종아리 근력은 족저굴곡 모멘트암을 형성하여 일상 보행에 필수적입니다.",
    "glutes": "요추 불안정성, 고관절 OA, 요천추 통증 환자에서 둔부 근력은 골반 안정화와 하지 동역학의 기초입니다.",
    "abdominals": "요추 디스크, 만성 요통 환자에서 코어 안정화는 척추 하중 분산과 근육 스파스 역할을 합니다.",
    "lower back": "만성 요통 환자에서는 등척성 강화가 유리하며, 굴곡·신전 반복은 디스크 부하를 증가시킬 수 있어 주의가 필요합니다.",
    "chest": "어깨 충돌증후군, 견관절 불안정성 환자에서는 흉부 근육의 과긴장이 신전을 제한할 수 있어 스트레칭 병행이 권장됩니다.",
    "shoulders": "회전근개 건병증, 견관절 OA에서 델토이드 단독 과부하는 회전근개에 부담을 줄 수 있어 저강도·고반복이 유리합니다.",
    "biceps": "이두박근 건염, 주관절 통증 시 편심성 수축(신장성)은 회복 초기에 피하고 등척성· concentric으로 시작합니다.",
    "triceps": "삼두박근 과사용 시 주관절 후방부 통증이 발생할 수 있어 무릎 꿇고 푸시다운 등 관절 부담을 줄인 자세가 권장됩니다.",
    "forearms": "손목터널증후군, 테니스엘보우 환자에서는 전완 근육의 과긴장 완화와 스트레칭이 선행되어야 합니다.",
}

# ========== 물리치료 차트용: 기시/정지/지배신경 (Anatomical Focus) ==========
ANATOMICAL_FOCUS = {
    "quadriceps": "대퇴사두근: 기시(장골·대퇴골 전면), 정지(경골조면·슬개골), 지배신경(대퇴신경 L2–L4).",
    "hamstrings": "햄스트링: 기시(좌골결절), 정지(경골·비골 두부), 지배신경(경골신경 L5–S2, 좌골신경).",
    "calves": "비복근·가자미근: 기시(대퇴골 외·내측두, 경골 뒤면), 정지(종골), 지배신경(경골신경 S1–S2).",
    "glutes": "대둔근: 기시(장골·천골·미골), 정지(대퇴골 전자부), 지배신경(하둔근신경 L5–S2).",
    "abdominals": "복직근·내외복사근: 기시(늑골·장골능), 정지(치골·백선), 지배신경(늑간신경 T7–T12, 장골하복부신경).",
    "lower back": "척추기립근: 기시(천골·장골·척추 가시돌기), 정지(늑골·두개저), 지배신경(등신경 posterior rami).",
    "chest": "대흉근: 기시(쇄골·흉골·복직근초막), 정지(상완골 대결절능), 지배신경(흉골내·외측신경 C5–T1).",
    "shoulders": "삼각근: 기시(쇄골·견봉·견갑골극), 정지(상완골 삼각근조면), 지배신경(액와신경 C5–C6).",
    "biceps": "이두박근: 기시(관절와·오구돌기), 정지(요골조면), 지배신경(근피신경 C5–C6).",
    "triceps": "삼두박근: 기시(관절와·상완골 뒤면), 정지(척골 팔꿈치돌기), 지배신경(요골신경 C6–C8).",
    "forearms": "전완 굴곡·신전근군: 기시(상완골 내측·외측상과, 요골·척골), 정지(수근골·지골), 지배신경(정중·요골·척골신경).",
}

# 관절 부하 급증 각도·보상작용 (Biomechanical Limit)
BIOMECHANICAL_LIMIT = {
    "squat": "슬관절 90° 이하에서 슬개대퇴 압력 급증. 보상: 무릎 내번(valgus), 발목 내번, 요추 과굴곡.",
    "lunge": "전방 슬관절 90° 부근에서 전방 전단력·슬개압 최대. 보상: 상체 전경, 골반 비틀림.",
    "plank": "요추 과신전 시 추간관절·후방 요소 부하. 보상: 힙 상승, 머리 처짐, 어깨 과내전.",
    "pushup": "견관절 90° 내전 시 충돌 위험. 보상: 요추 함몰, 골반 전경.",
    "deadlift": "요추 굴곡 구간에서 디스크 후방 압력 급증. 보상: 흉요추 과신전, 무릎 선행.",
    "bridge": "고관절 신전 말기에서 요천추 부하. 보상: 둔부 쥐어짜기, 햄스트링 우세.",
    "leg_extension": "슬관절 신전 말기(0° 근접)에서 슬개압·전인대 부하. 보상: 힙 들림.",
    "default": "관절 말단 각도(ROM 말단)에서 캡슐·인대 부하 증가. 보상작용(대칭 운동 시 비대칭, 호흡 멈춤) 관찰.",
}

# 이 운동 시 악화되는 구체적 질환 (Clinical Contraindication)
CLINICAL_CONTRAINDICATION = {
    "quadriceps": ["슬개골 불안정성", "전십자인대 재건 수술 직후(OKC)", "슬개건염 급성기"],
    "hamstrings": ["햄스트링 근육 파열 급성기", "좌골결절 건염"],
    "calves": ["아킬레스건염 급성기", "비복근 근막 통증"],
    "glutes": ["고관절 치환술 직후(의료진 지시 전)", "둔근 건병증"],
    "abdominals": ["복부 수술 직후", "제왕절개·탈장 수술 재활 초기"],
    "lower back": ["요추 추간판 탈출증 급성기", "척추 불안정성", "압박골절 급성기"],
    "chest": ["견봉쇄골관절 손상", "흉골 불안정"],
    "shoulders": ["회전근개 완전 파열", "견관절 전방 불안정성(비수술적 급성기)"],
    "biceps": ["장두건 파열", "이두건염 급성기"],
    "triceps": ["삼두건염 급성기", "주관절 후방 불안정"],
    "forearms": ["손목터널증후군 급성기", "테니스엘보우 급성기"],
}

# 재활 효과에 대한 학술적 근거 (Expert Rationale)
EXPERT_RATIONALE_TEMPLATE = (
    "CKC 운동은 관절 공유 수축을 유도해 인대·캡슐 부하를 분산시키며(Knight, 1995), "
    "기능적 패턴으로 전이 효과가 높다(SAID 원칙). "
    "편심 수축 강화는 건-골 접합부 적응을 촉진해 재손상 예방에 유리하다(Rees et al.). "
    "본 운동은 해당 근군의 근력·지구력·신경근 조절을 동시에 요구하므로 재활 중기 이후 단계에 적합하다."
)
EXPERT_RATIONALE_BY_MUSCLE = {
    "quadriceps": "슬관절 CKC 강화는 PFPS·전방 슬관절 통증 감소와 보행 대칭성 개선에 유효하다는 근거가 있다(van Linschoten et al.).",
    "hamstrings": "햄스트링 편심 강화는 재손상률 감소와 달리기 역학 개선과 연관된다(Nordic hamstring 연구).",
    "abdominals": "코어 등척 강화는 요통 재발 감소 및 LBP 환자 기능 개선과 연관된다(Hodges, Richardson).",
    "lower back": "척추기립근 등척·저부하 강화는 만성 요통 관리 가이드라인에서 1차 권고에 포함된다.",
    "glutes": "둔부 강화는 요천추 통증·고관절 OA 환자에서 통증 감소와 기능 향상과 연관된다.",
}

# CKC vs OKC 판별 키워드
CKC_KEYWORDS = ["squat", "lunge", "step", "plank", "push-up", "pushup", "bridge", "wall", "floor"]
OKC_KEYWORDS = ["leg extension", "leg curl", "leg curl", "fly", "pullover", "curl", "extension", "kickback"]

# ========== 한국 검색 인기 가중치 (2023 국민생활체육조사·홈트 검색 트렌드 반영) ==========
# 출처: 걷기·등산·보디빌딩·요가필라테스 상위, 홈트 인기(플랭크·스쿼트·런지·푸시업 등)
POPULAR_SEARCH_BOOST = [
    ("플랭크", 15), ("plank", 15),
    ("스쿼트", 15), ("squat", 15),
    ("런지", 12), ("lunge", 12),
    ("푸시업", 12), ("푸쉬업", 12), ("push-up", 12), ("pushup", 12),
    ("데드리프트", 10), ("deadlift", 10),
    ("브릿지", 10), ("bridge", 10),
    ("스텝", 10), ("step", 10),  # 등산·걷기 연관
    ("걷기", 8), ("워킹", 8), ("walking", 8), (" tread", 8),
    ("덤벨", 8), ("dumbbell", 8),
    ("코어", 8), ("core", 8),
    ("레그컬", 6), ("leg curl", 6),
    ("레그프레스", 6), ("leg press", 6),
    ("크런치", 6), ("crunch", 6),
    ("밴드", 5), ("band", 5),
]

# ========== 안전성 점수 계산 ==========
LEVEL_SCORE = {"beginner": 3, "intermediate": 2, "expert": 1}
EQUIPMENT_SCORE = {
    "body only": 3,
    "machine": 2.5,
    "exercise ball": 2.5,
    "bands": 2,
    "kettlebells": 2,
    "dumbbell": 2,
    "cable": 2,
    "barbell": 1.5,
    "e-z curl bar": 1.5,
}


def safety_score(ex: dict, korean_name: str) -> float:
    """안전성 점수: 초보자·저부상 위험 우선."""
    level = (ex.get("level") or "intermediate").lower()
    eq = (ex.get("equipment") or "body only").lower()
    mechanic = (ex.get("mechanic") or "compound").lower()
    muscles = (ex.get("primaryMuscles") or []) + (ex.get("secondaryMuscles") or [])
    name_lower = (ex.get("name", "") + " " + korean_name).lower()

    score = LEVEL_SCORE.get(level, 1.5) * 10
    score += EQUIPMENT_SCORE.get(eq, 1.5) * 5

    # body only / machine = 가산
    if eq in ("body only", "machine"):
        score += 5
    # lower back 위주 = 가산 감소
    if "lower back" in muscles and "abdominals" not in muscles:
        score -= 3
    # CKC 운동 = 재활·안전에 유리
    if any(k in name_lower for k in CKC_KEYWORDS):
        score += 3
    # 한국 검색 인기 가중치: 많이 검색되는 종목 우선 포함 (매칭 중 최대값 1회)
    search_boost = 0
    for keyword, boost in POPULAR_SEARCH_BOOST:
        if keyword in name_lower and boost > search_boost:
            search_boost = boost
    score += search_boost
    return score


def is_ckc(ex: dict, korean_name: str) -> bool:
    """Closed Kinetic Chain 여부."""
    name = (ex.get("name", "") + " " + korean_name).lower()
    if any(k in name for k in CKC_KEYWORDS):
        return True
    if any(k in name for k in OKC_KEYWORDS):
        return False
    eq = (ex.get("equipment") or "").lower()
    return eq in ("body only", "machine")


def gen_biomechanical_rationale(ex: dict, korean_name: str) -> str:
    """역학적 근거: 주동근·길항근, 모멘트암."""
    primary = ex.get("primaryMuscles") or []
    secondary = ex.get("secondaryMuscles") or []
    mechanic = ex.get("mechanic", "compound")
    ckc = is_ckc(ex, korean_name)

    muscles_ko = {
        "quadriceps": "대퇴사두근", "hamstrings": "햄스트링", "calves": "종아리",
        "glutes": "둔부", "abdominals": "복부", "lower back": "척추기립근",
        "chest": "흉부", "shoulders": "어깨", "biceps": "이두근", "triceps": "삼두근",
        "forearms": "전완",
    }
    prime = ", ".join(muscles_ko.get(m, m) for m in primary[:3])
    sec = ", ".join(muscles_ko.get(m, m) for m in secondary[:3]) if secondary else "보조근육"

    chain = "폐쇄 운동 사슬(CKC)" if ckc else "개방 운동 사슬(OKC)"
    base = f"{prime}이(가) 주동근으로 작용하며, {sec}이(가) 안정화·길항근으로 참여합니다. {chain} 특성상 관절에 가해지는 모멘트암이 동작 각도에 따라 변화합니다."
    if mechanic == "compound":
        base += " 복합 관절 동작으로 여러 관절이 동시에 가동되어 기능적 패턴에 가깝습니다."
    return base


def gen_clinical_insight(ex: dict, korean_name: str) -> str:
    """임상적 통찰: 특정 질환과의 연관성."""
    primary = ex.get("primaryMuscles") or []
    ckc = is_ckc(ex, korean_name)
    insights = []
    for m in primary[:2]:
        if m in MUSCLE_CLINICAL_INSIGHT:
            insights.append(MUSCLE_CLINICAL_INSIGHT[m])

    if not insights:
        return "전반적인 근력·안정성 향상에 도움이 됩니다. 기저 질환이 있을 경우 의료진과 상담 후 진행하시기 바랍니다."

    base = " ".join(insights[:2])
    if ckc:
        base += " 특히 무릎·고관절 재활 초기에는 발이 지면에 닿은 CKC 운동이 인대·관절낭 안정성에 유리합니다."
    return base


def gen_regression_progression(ex: dict, korean_name: str) -> str:
    """Regression & Progression: 통증 수준에 따른 난이도 조절."""
    level = ex.get("level", "intermediate")
    ckc = is_ckc(ex, korean_name)
    name = ex.get("name", "").lower()

    parts = []
    # Regression (난이도 하향)
    parts.append("【Regress (통증·제한 시)】")
    if "squat" in name or "스쿼트" in korean_name:
        parts.append("벽에 등 대고 20도 이하 등척성 벽 스쿼트 → 슬관절 압박 최소화. 의자에 앉았다 일어나기로 대체 가능.")
    elif "plank" in name or "플랭크" in korean_name:
        parts.append("무릎 대고 수행, 또는 벽 푸시업으로 난이도 하향. 손목 통증 시 주먹 쥔 자세로 지지.")
    elif "lunge" in name or "런지" in korean_name:
        parts.append("짧은 보폭, 또는 정지 런지. 균형 문제 시 의자·벽에 손을 대고 보조.")
    else:
        parts.append("각도 축소, 보조도구(밴드·벽·의자) 활용, 반복 횟수 감소로 강도 조절.")
    parts.append("")

    # Progression (난이도 상향)
    parts.append("【Progress (여유 시)】")
    parts.append("TUT(Time Under Tension) 증가: 하강 3초, 상승 2초 등 편심·동심 수축 시간 연장. 단계적으로 부하·반복·세트 수 증가.")
    return "\n".join(parts)


def gen_red_flags(ex: dict, korean_name: str) -> str:
    """금기 신호: 즉시 중단해야 하는 징후."""
    primary = ex.get("primaryMuscles") or []
    parts = [
        "찌릿한 날카로운 통증(신경·인대 손상 가능성)",
        "관절 내 까짐·붙는 느낌(meniscus, 연골 손상 의심)",
        "통증이 점점 악화되는 양상",
        "손발 저림·마비감 동반",
    ]
    if "lower back" in primary or "abdominals" in primary:
        parts.append("요추 부위 찌릿함·방사통(디스크 압박 의심)")
    if "quadriceps" in primary or "hamstrings" in primary:
        parts.append("무릎 불안정감·꺾이는 느낌(인대 손상 의심)")
    return "운동 중 다음이 있으면 즉시 중단하고 의료진 상담: " + "; ".join(parts)


def add_tut_recommendation(ex: dict) -> str:
    """Time Under Tension 권장."""
    force = (ex.get("force") or "").lower()
    if force == "static":
        return "30초~60초 유지. 시니어·초보자는 15초부터 시작해 점진적으로 연장."
    return "3초 하강(편심), 1~2초 상승(동심). 총 TUT 40~60초/세트 권장."


def add_proprioception_tip(ex: dict, korean_name: str) -> Optional[str]:
    """고유수용감각 활용 팁 (균형·재활 운동 시)."""
    name = (ex.get("name", "") + " " + korean_name).lower()
    if any(k in name for k in ["lunge", "런지", "step", "스텝", "balance", "서기"]):
        return "시니어·재활 시: 눈을 감고 한 발 서기 등 균형 훈련을 병행하면 뇌-근육 신경 연결도(proprioception)를 높일 수 있습니다."
    return None


# ---------- 물리치료 차트용 4필드 ----------
def gen_anatomical_focus(ex: dict) -> str:
    """주동근의 기시/정지점 및 지배 신경(Innervation)."""
    primary = ex.get("primaryMuscles") or []
    parts = []
    for m in primary[:3]:
        if m in ANATOMICAL_FOCUS:
            parts.append(ANATOMICAL_FOCUS[m])
    if not parts:
        return "주동근 정보가 등록되지 않은 종목입니다. 운동 시 주로 동원되는 근육의 기시·정지·지배신경은 해부학 참고서를 확인하세요."
    return " ".join(parts)


def gen_biomechanical_limit(ex: dict, korean_name: str) -> str:
    """관절 부하가 급증하는 각도 및 주의해야 할 보상 작용."""
    name = (ex.get("name", "") + " " + korean_name).lower()
    if "squat" in name or "스쿼트" in name:
        return BIOMECHANICAL_LIMIT["squat"]
    if "lunge" in name or "런지" in name:
        return BIOMECHANICAL_LIMIT["lunge"]
    if "plank" in name or "플랭크" in name:
        return BIOMECHANICAL_LIMIT["plank"]
    if "push" in name or "푸시" in name:
        return BIOMECHANICAL_LIMIT["pushup"]
    if "deadlift" in name or "데드" in name:
        return BIOMECHANICAL_LIMIT["deadlift"]
    if "bridge" in name or "브릿지" in name:
        return BIOMECHANICAL_LIMIT["bridge"]
    if "leg extension" in name or "레그익스" in name:
        return BIOMECHANICAL_LIMIT["leg_extension"]
    return BIOMECHANICAL_LIMIT["default"]


def gen_clinical_contraindication(ex: dict) -> List[str]:
    """이 운동을 하면 상태가 악화되는 구체적 질환명 리스트."""
    primary = ex.get("primaryMuscles") or []
    out = []
    seen = set()
    for m in primary:
        if m in CLINICAL_CONTRAINDICATION:
            for cond in CLINICAL_CONTRAINDICATION[m]:
                if cond not in seen:
                    seen.add(cond)
                    out.append(cond)
    if not out:
        return ["급성 염증·파열·수술 직후(의료진 허가 전)"]
    return out


def gen_expert_rationale(ex: dict) -> str:
    """이 운동이 재활 관점에서 왜 효과적인지에 대한 학술적 근거."""
    primary = ex.get("primaryMuscles") or []
    parts = [EXPERT_RATIONALE_TEMPLATE]
    for m in primary[:2]:
        if m in EXPERT_RATIONALE_BY_MUSCLE:
            parts.append(EXPERT_RATIONALE_BY_MUSCLE[m])
            break
    return " ".join(parts)


def load_all_exercises(folder: Path) -> List[dict]:
    """폴더 내 모든 JSON 로드."""
    exercises = []
    for f in folder.glob("*.json"):
        try:
            with open(f, "r", encoding="utf-8") as fp:
                data = json.load(fp)
            if isinstance(data, dict):
                data["_source_file"] = f.name
                data["_korean_name"] = f.stem  # 파일명(한글) = 운동명
                exercises.append(data)
            elif isinstance(data, list):
                for i, item in enumerate(data):
                    if isinstance(item, dict):
                        item = item.copy()
                        item["_source_file"] = f.name
                        item["_korean_name"] = item.get("name", f.stem) or f.stem
                        exercises.append(item)
        except Exception as e:
            print(f"⚠️ {f.name} 로드 실패: {e}")
    return exercises


def enrich_exercise(ex: dict) -> dict:
    """전문 필드 추가."""
    korean_name = ex.get("_korean_name", "")
    out = {k: v for k, v in ex.items() if not k.startswith("_")}
    out["korean_name"] = korean_name

    # 엘리트 전문가용 필드
    out["biomechanical_rationale"] = gen_biomechanical_rationale(ex, korean_name)
    out["clinical_insight"] = gen_clinical_insight(ex, korean_name)
    out["regression_progression"] = gen_regression_progression(ex, korean_name)
    out["red_flags"] = gen_red_flags(ex, korean_name)

    # CKC/OKC, TUT, Proprioception
    out["kinetic_chain"] = "CKC" if is_ckc(ex, korean_name) else "OKC"
    out["time_under_tension"] = add_tut_recommendation(ex)
    pt = add_proprioception_tip(ex, korean_name)
    if pt:
        out["proprioception_tip"] = pt

    # 물리치료 차트용 4필드
    out["anatomical_focus"] = gen_anatomical_focus(ex)
    out["biomechanical_limit"] = gen_biomechanical_limit(ex, korean_name)
    out["clinical_contraindication"] = gen_clinical_contraindication(ex)
    out["expert_rationale"] = gen_expert_rationale(ex)

    return out


def build_architecture_meta() -> dict:
    """4단계 답변 프로토콜 및 아키텍처 메타."""
    return {
        "architecture": {
            "4단계_답변_프로토콜": {
                "1_안전성_스크리닝": "무릎 통증이 '찌릿'한 양상인가요, 아니면 '뻐근'한 양상인가요? → 날카로운 통증 시 운동 금지 권고 및 병원 방문 가이드",
                "2_역학적_변형": "의사가 스쿼트를 금지했더라도, 도슨트는 관절 압박이 0에 수렴하는 '등척성 벽 스쿼트 20도'를 처방",
                "3_생리학적_회복": "관절 내 활액 분비 촉진으로 연골 영양 공급 역할 설명",
                "4_영양적_시너지": "근지구력 운동 후 오메가3 등 항염 섭취 추천",
            },
            "데이터_포인트": {
                "CKC_vs_OKC": "무릎 재활 초기에는 발이 지면에 닿은 CKC가 인대 안정성에 유리",
                "TUT": "3초간 천천히 내려가며 근육의 신장성 수축(Eccentric) 유도",
                "Proprioception": "눈을 감고 한 발 서기로 뇌-근육 신경 연결도 향상",
            },
        },
    }


def main():
    folder = EXERCISE_FOLDER
    if not folder.exists():
        print(f"❌ 폴더 없음: {folder}")
        return

    print("📂 운동 데이터 로드 중…")
    exercises = load_all_exercises(folder)
    print(f"   총 {len(exercises)}건 로드됨")

    # 안전성 점수로 정렬 후 상위 100
    scored = [(ex, safety_score(ex, ex.get("_korean_name", ""))) for ex in exercises]
    scored.sort(key=lambda x: -x[1])
    selected = [x[0] for x in scored[:TOP_N]]

    print(f"📋 안전성 우선 상위 {TOP_N}종목 선별 완료")

    # 전문 필드 추가
    enriched = [enrich_exercise(ex) for ex in selected]

    # 통합 출력
    meta = build_architecture_meta()
    output = {
        "meta": meta,
        "total_count": len(enriched),
        "exercises": enriched,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"✅ docent_master_db.json 저장 완료: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
