export async function createClient() { // async 확인
    const cookieStore = await cookies() // 🚨 반드시 await를 붙여야 에러가 안 납니다!
    // ... 나머지 코드
  }