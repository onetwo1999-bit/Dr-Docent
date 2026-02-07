import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./store/**/*.{js,ts,jsx,tsx,mdx}",
    "./types/**/*.{js,ts,jsx,tsx,mdx}",
    "./utils/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'ai-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.05)' },
        },
        'chat-reveal-11-5': {
          '0%': {
            opacity: '0',
            transform: 'perspective(180px) rotateX(6deg) translate(-6px, -6px)',
          },
          '100%': {
            opacity: '1',
            transform: 'perspective(180px) rotateX(0deg) translate(0, 0)',
          },
        },
      },
      animation: {
        'ai-pulse': 'ai-pulse 2s ease-in-out infinite',
        'chat-reveal-11-5': 'chat-reveal-11-5 0.72s ease-out forwards',
      },
      colors: {
        primary: "#2DD4BF", // 닥터 도슨트 메인 컬러
      },
      screens: {
        xs: "390px",   // 작은 모바일
        sm: "640px",   // 모바일 가로
        md: "768px",   // 태블릿
        lg: "1024px",  // 데스크톱
        xl: "1280px",  // 와이드 데스크톱
        "2xl": "1536px",
      },
      maxWidth: {
        "8xl": "88rem",  // 1408px - 맥북 등에서 과도한 늘어남 방지
      },
      spacing: {
        "safe-top": "env(safe-area-inset-top, 0px)",
        "safe-bottom": "env(safe-area-inset-bottom, 0px)",
      },
    },
  },
  plugins: [],
};
export default config;
