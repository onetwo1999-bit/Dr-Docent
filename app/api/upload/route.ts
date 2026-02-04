import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ========================
// 📤 이미지 업로드 API
// Supabase Storage 'meal-photos' 버킷 사용
// ========================

const BUCKET_NAME = 'meal-photos'

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
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
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

/** UUID v4 생성 (Node 19+ / 브라우저 crypto.randomUUID 사용 가능 시) */
function generateUniqueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).slice(2, 8).toUpperCase()
  console.log(`\n📤 [Upload] POST 요청 시작 (ID: ${requestId})`)

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(`❌ [${requestId}] Supabase 환경 변수 누락`)
      return NextResponse.json(
        { error: '서버 설정이 올바르지 않습니다.' },
        { status: 500 }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error(`❌ [${requestId}] 인증 실패:`, authError)
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const category = (formData.get('category') as string) || 'meal'

    if (!file) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다.' },
        { status: 400 }
      )
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: '파일 크기는 5MB 이하여야 합니다.' },
        { status: 400 }
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: '이미지 파일만 업로드 가능합니다.' },
        { status: 400 }
      )
    }

    // 파일명: userId/카테고리/uuid_타임스탬프.확장자 (중복 방지)
    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '')
    const uniqueId = generateUniqueId()
    const timestamp = Date.now()
    const safeName = `${uniqueId}_${timestamp}.${ext}`
    const filePath = `${user.id}/${category}/${safeName}`

    console.log(`📁 [${requestId}] 업로드 대상:`, {
      bucket: BUCKET_NAME,
      filePath,
      size: file.size,
      type: file.type
    })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error(`❌ [${requestId}] 업로드 실패:`, uploadError)

      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        return NextResponse.json(
          {
            error: '저장소 버킷을 찾을 수 없습니다.',
            hint: `Supabase 대시보드 → Storage에서 "${BUCKET_NAME}" 버킷을 생성하고, Public으로 설정해주세요.`
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { error: uploadError.message || '파일 업로드에 실패했습니다.' },
        { status: 500 }
      )
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadData.path)

    console.log(`✅ [${requestId}] 업로드 성공:`, { path: uploadData.path, url: urlData.publicUrl })

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: uploadData.path
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`❌ [${requestId}] 서버 에러:`, error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: message },
      { status: 500 }
    )
  }
}
