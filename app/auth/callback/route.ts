import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return Response.redirect(new URL('/', request.url))
    }
  }

  // 에러 발생 시 에러 페이지로 리디렉션
  return Response.redirect(new URL('/auth/error', request.url))
}
