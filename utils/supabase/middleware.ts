// utils/supabase/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value ?? null;
        },

        // ✅ response에만 set (Edge-safe)
        set(name: string, value: string, options?: any) {
          response.cookies.set({ name, value, ...(options ?? {}) } as any);
        },

        remove(name: string) {
          response.cookies.set({ name, value: "", maxAge: 0 } as any);
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}
