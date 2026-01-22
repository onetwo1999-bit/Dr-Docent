export async function GET(request: Request) {
    // ... 
    if (code) {
      const supabase = await createClient() // 🚨 여기서도 await를 꼭 붙이세요!
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      // ...
    }
  }