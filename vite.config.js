import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/wird-app/', // تأكد أن هذا يطابق اسم المستودع في حسابك
});
