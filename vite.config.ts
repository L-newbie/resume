import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' → 产物用相对路径引用资源，可直接部署到 GitHub Pages 的任意子路径
// （user.github.io/repo-name/），也可以本地双击 index.html 打开。
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 19457, strictPort: true },
  preview: { host: '127.0.0.1', port: 19457, strictPort: true },
  build: {
    target: 'es2020',
    // 3D 相关代码单独成块，由 <Suspense> 懒加载 —— 首屏 HTML/CSS 不等 three.js
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
