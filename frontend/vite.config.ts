import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** 使用相对路径，方便静态托管或后续嵌入桌面程序。 */
export default defineConfig({
  plugins: [react()],
  base: './',
})

