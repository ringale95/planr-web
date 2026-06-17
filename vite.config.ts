import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative so the same build works on
// GitHub Pages (project page) AND when served locally over the LAN.
// host:true binds 0.0.0.0 so the phone can reach it at the laptop's LAN IP.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
