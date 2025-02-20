/** @type {import('tailwindcss').Config} */
export default {
  // ダークモードをクラスベースで制御する設定
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      // カスタムカラーの定義
      colors: {
        // ライトモード時の背景色
        lightBackground: '#ffffff',
        // ダークモード時の背景色
        darkBackground: '#1a202c', // Tailwindのgray-900相当
      },
      // typographyプラグインを利用して、本文テキストなどを調整
      typography: (theme) => ({
        // デフォルト設定
        DEFAULT: {
          css: {
            maxWidth: 'none',
            // ライトモードのデフォルトテキストカラー
            color: '#333',
            a: {
              color: '#3182ce',
              '&:hover': {
                color: '#2c5282',
              },
            },
          },
        },
        // ダークモード時の設定
        dark: {
          css: {
            // ダークモードのデフォルトテキストカラー
            color: '#ffffff',
            a: {
              color: '#90cdf4',
              '&:hover': {
                color: '#63b3ed',
              },
            },
            // 見出しや引用、コードブロックなどの色もダークモード用に上書き
            h1: { color: '#ffffff' },
            h2: { color: '#ffffff' },
            h3: { color: '#ffffff' },
            h4: { color: '#ffffff' },
            h5: { color: '#ffffff' },
            h6: { color: '#ffffff' },
            blockquote: {
              color: '#d1d5db',
              borderLeftColor: '#4c51bf',
            },
            code: {
              color: '#ffffff',
              backgroundColor: '#2d3748',
            },
            pre: {
              backgroundColor: '#2d3748',
            },
          },
        },
      }),
    },
  },
  plugins: [
    // Tailwind公式プラグイン: typography
    require('@tailwindcss/typography'),
    // Tailwind公式プラグイン: forms
    require('@tailwindcss/forms'),
  ],
};
