import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    allowedHosts: ['kebos.top'],
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',

    // ������ 绝对不能开
    sourcemap: false,

    // ✅ 用 esbuild，禁止 terser
    minify: 'esbuild',
    
    // 提高警告阈值
    chunkSizeWarningLimit: 2000,

    // 优化打包配置
    rollupOptions: {
      // 保持低并发以适应低配机器
      maxParallelFileOps: 1,
      output: {
        // 自动拆包策略：将大文件拆分为多个小文件，利用浏览器并行加载，减少单文件体积
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 1. PDF 处理库 (最重)
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('pdfkit') || id.includes('@react-pdf')) {
              return 'pdf-lib';
            }
            // 2. Excel 处理库
            if (id.includes('exceljs')) {
              return 'excel-lib';
            }
            // 3. 基础框架 (React 全家桶)
            if (id.includes('react') || id.includes('scheduler') || id.includes('remix-run')) {
              return 'react-vendor';
            }
            // 4. UI 组件库
            if (id.includes('recharts') || id.includes('lucide') || id.includes('framer-motion')) {
              return 'ui-vendor';
            }
            // 5. 其他依赖
            return 'vendor';
          }
        }
      }
    }
  }
})


