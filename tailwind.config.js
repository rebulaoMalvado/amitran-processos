/** @type {import('tailwindcss').Config} */
// Tokens espelham o protótipo (amitran-processos-v1_1.html) — fonte de verdade do design.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F6F7F9',
        sidebar: '#FFFFFF',
        card: '#FFFFFF',
        border: '#E8EAEE',
        'border-2': '#DDE0E6',
        text: '#0F172A',
        muted: '#64748B',
        'muted-2': '#94A3B8',
        primary: '#2563EB',
        'primary-hover': '#1D4FD8',
        'primary-weak': '#EFF4FF',
        // status das abas
        'st-fechadas': '#6366F1',
        'st-faturamento': '#EAB308',
        'st-acompanhamento': '#3B82F6',
        'st-recebido': '#22C55E',
        'st-danger': '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15,23,42,.05)',
        md: '0 1px 3px rgba(15,23,42,.06),0 8px 24px rgba(15,23,42,.06)',
        lg: '0 10px 15px rgba(15,23,42,.08),0 30px 60px rgba(15,23,42,.14)',
      },
      ringColor: {
        DEFAULT: 'rgba(37,99,235,.35)',
      },
    },
  },
  plugins: [],
}
