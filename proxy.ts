// proxy.ts - 비활성화됨 (Layout 기반 인증으로 전환)
import { NextResponse } from 'next/server'

export async function proxy() {
  // 모든 요청을 그냥 통과시킴
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
