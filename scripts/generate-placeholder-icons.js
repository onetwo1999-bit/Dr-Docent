/**
 * PWA 아이콘 플레이스홀더 생성 스크립트
 * 
 * 이 스크립트는 간단한 플레이스홀더 아이콘을 생성합니다.
 * 프로덕션 환경에서는 실제 디자인된 아이콘으로 교체하세요.
 * 
 * 사용 방법:
 * 1. sharp 패키지 설치: npm install --save-dev sharp
 * 2. 스크립트 실행: node scripts/generate-placeholder-icons.js
 */

const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const publicDir = path.join(process.cwd(), 'public')
const iconSizes = [192, 512]
const brandColor = '#2DD4BF' // 닥터 도슨 브랜드 컬러

async function generateIcon(size) {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${brandColor}"/>
      <text 
        x="50%" 
        y="50%" 
        font-family="Arial, sans-serif" 
        font-size="${size * 0.3}" 
        font-weight="bold" 
        fill="white" 
        text-anchor="middle" 
        dominant-baseline="middle"
      >DD</text>
    </svg>
  `

  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer()

  const outputPath = path.join(publicDir, `icon-${size}x${size}.png`)
  fs.writeFileSync(outputPath, pngBuffer)
  console.log(`✅ 생성 완료: ${outputPath}`)
}

async function main() {
  try {
    // public 디렉토리 확인
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true })
    }

    // 각 크기의 아이콘 생성
    for (const size of iconSizes) {
      await generateIcon(size)
    }

    console.log('\n🎉 모든 아이콘이 성공적으로 생성되었습니다!')
    console.log('📝 참고: 프로덕션 환경에서는 실제 디자인된 아이콘으로 교체하세요.')
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('❌ sharp 패키지가 설치되지 않았습니다.')
      console.log('💡 설치 방법: npm install --save-dev sharp')
    } else {
      console.error('❌ 에러 발생:', error.message)
    }
    process.exit(1)
  }
}

main()
