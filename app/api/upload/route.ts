import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ========================
// 📤 이미지 업로드 API
// Supabase Storage를 사용한 파일 업로드
// ========================

async function createClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Route Handler에서 쿠키 설정 실패 시 무시
          }
        },
      },
    }
  )
}

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).slice(2, 8).toUpperCase()
  console.log(`\n📤 [Upload] POST 요청 시작 (ID: ${requestId})`)

  try {
    // 인증 확인
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error(`❌ [${requestId}] 인증 실패:`, authError)
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // FormData 파싱
    const formData = await req.formData()
    const file = formData.get('file') as File
    const category = formData.get('category') as string || 'general'

    if (!file) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다.' },
        { status: 400 }
      )
    }

    // 파일 크기 검증 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: '파일 크기는 5MB 이하여야 합니다.' },
        { status: 400 }
      )
    }

    // 파일 타입 검증 (이미지만)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: '이미지 파일만 업로드 가능합니다.' },
        { status: 400 }
      )
    }

    // 파일명 생성 (사용자ID_타임스탬프_랜덤.확장자)
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${category}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
    const filePath = `health-logs/${fileName}`

    console.log(`📁 [${requestId}] 파일 업로드 시작:`, {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      filePath
    })

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Supabase Storage에 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('health-images')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error(`❌ [${requestId}] 업로드 실패:`, uploadError)
      
      // 버킷이 없는 경우 안내
      if (uploadError.message?.includes('Bucket not found')) {
        return NextResponse.json(
          { 
            error: '저장소 버킷이 설정되지 않았습니다.',
            hint: 'Supabase 대시보드에서 "health-images" 버킷을 생성해주세요.'
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: uploadError.message || '파일 업로드에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 공개 URL 생성
    const { data: urlData } = supabase.storage
      .from('health-images')
      .getPublicUrl(filePath)

    console.log(`✅ [${requestId}] 업로드 성공:`, {
      path: filePath,
      url: urlData.publicUrl
    })

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath
    })

  } catch (error: any) {
    console.error(`❌ [${requestId}] 서버 에러:`, error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    )
  }
}
