module.exports = {
  content: ['../web/index.html', '../web/js/*.js'],
  safelist: ['pill-gray','pill-brand','pill-green','pill-amber','pill-red','pill-blue','btn-primary','btn-danger','btn-success','btn-dark','btn-gold','btn-soft','h-16','h-28'],
  theme: {
    extend: {
      fontFamily: { sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'], display: ['"Alexandria"', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#f6f2fb', 100: '#ece3f7', 200: '#d9c7ee', 300: '#bd9fe0', 400: '#9b70cd', 500: '#7c4bb6', 600: '#66369d', 700: '#552c83', 800: '#46256b', 900: '#3a2059', 950: '#22103a' },
        gold: { 50: '#fffaeb', 100: '#fef0c7', 200: '#fde08a', 300: '#fbc94d', 400: '#f9b224', 500: '#f0930b', 600: '#d46d06', 700: '#b04c09' },
        ink: { 950: '#0f0a1a' }
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,8,32,.04), 0 4px 16px -4px rgba(16,8,32,.08)',
        lift: '0 2px 4px rgba(16,8,32,.04), 0 12px 32px -8px rgba(34,16,58,.18)',
        glow: '0 8px 30px -6px rgba(124,75,182,.55)'
      },
      borderRadius: { '4xl': '2rem' },
      keyframes: {
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'pop-in': { from: { opacity: 0, transform: 'translateY(8px) scale(.98)' }, to: { opacity: 1, transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(-100%)' } },
        progress: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(-100%)' } }
      },
      animation: {
        'sheet-up': 'sheet-up .28s cubic-bezier(.2,.8,.2,1)',
        'fade-in': 'fade-in .2s ease-out',
        'pop-in': 'pop-in .25s cubic-bezier(.2,.8,.2,1)',
        progress: 'progress 1.1s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
