/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class', // ダークモードをクラスベースで制御
    content: [
      './index.html',
      './src/**/*.{js,ts,jsx,tsx}'
    ],
    theme: {
      extend: {
        colors: {
          lightBackground: '#ffffff', // ライトモードの背景色
          darkBackground: '#1a202c', // ダークモードの背景色 (Tailwindのgray-900)
        },
        typography: (theme) => ({
          DEFAULT: {
            css: {
              maxWidth: 'none',
              color: '#333', // ライトモードのデフォルトテキストカラー
              a: {
                color: '#3182ce',
                '&:hover': {
                  color: '#2c5282',
                },
              },
            },
          },
          dark: {
            css: {
              color: '#ffffff', // ダークモードのデフォルトテキストカラー
              a: {
                color: '#90cdf4',
                '&:hover': {
                  color: '#63b3ed',
                },
              },
              h1: {
                color: '#ffffff',
              },
              h2: {
                color: '#ffffff',
              },
              h3: {
                color: '#ffffff',
              },
              h4: {
                color: '#ffffff',
              },
              h5: {
                color: '#ffffff',
              },
              h6: {
                color: '#ffffff',
              },
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
      require('@tailwindcss/typography'),
      require('@tailwindcss/forms')
    ],
  };