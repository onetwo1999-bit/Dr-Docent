# PWA 아이콘 설정 가이드

## 문제 상황
현재 `manifest.json`에서 참조하는 `icon-192x192.png`와 `icon-512x512.png` 파일이 `public` 폴더에 없어 404 에러가 발생하고 있습니다.

## 해결 방법

### 방법 1: 온라인 도구 사용 (권장)

1. **Favicon Generator 사용**
   - https://realfavicongenerator.net/ 접속
   - 로고 이미지 업로드 (또는 텍스트로 아이콘 생성)
   - "Generate your Favicons and HTML code" 클릭
   - 다운로드한 파일 중 `android-chrome-192x192.png`와 `android-chrome-512x512.png`를 사용

2. **Canva 또는 Figma 사용**
   - 192x192px와 512x512px 크기의 정사각형 이미지 생성
   - 브랜드 컬러 (#2DD4BF)를 배경으로 사용
   - 심플한 의료 아이콘 또는 텍스트 추가
   - PNG 형식으로 내보내기

### 방법 2: 간단한 아이콘 생성 스크립트

Node.js 환경에서 간단한 아이콘을 생성할 수 있습니다:

```bash
# sharp 패키지 설치 (이미지 생성용)
npm install --save-dev sharp

# 스크립트 실행
node scripts/generate-icons.js
```

### 방법 3: 임시 해결 (개발 중)

개발 중에는 `manifest.json`에서 아이콘 섹션을 제거하거나 주석 처리할 수 있습니다:

```json
{
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

## 파일 배치

생성한 아이콘 파일을 다음 위치에 배치하세요:

```
public/
  ├── icon-192x192.png  (192x192 픽셀)
  ├── icon-512x512.png  (512x512 픽셀)
  └── manifest.json
```

## 확인 방법

1. 브라우저 개발자 도구 > Console 탭
2. 404 에러가 사라졌는지 확인
3. Application 탭 > Manifest에서 아이콘이 제대로 로드되는지 확인

## 참고

- PWA 아이콘은 최소 192x192px 이상이어야 합니다
- 투명 배경을 사용할 수 있지만, 대부분의 경우 단색 배경을 권장합니다
- 브랜드 컬러 (#2DD4BF)를 사용하여 일관성 유지
