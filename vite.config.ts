import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const apiProxy = {
  "/api": {
    target: "http://localhost:5000",
    /*
     * ส่ง IP จริงของ Tester ต่อให้ backend
     * (Careerjet ใช้ user_ip)
     */
    xfwd: true,
  },
}

/*
 * Vite บล็อก Host ที่ไม่รู้จัก
 * อนุญาต domain ของ Cloudflare Quick Tunnel
 */
const allowedHosts = [".trycloudflare.com"]

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": fileURLToPath(
        new URL("./src", import.meta.url),
      ),
    },
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: apiProxy,
    allowedHosts,
  },

  preview: {
    host: "0.0.0.0",
    port: 4173,
    proxy: apiProxy,
    allowedHosts,
  },
})