import { defineConfig } from "vite";

// La web lee archivos de otros carriles (deployments/, design/, reports/, parcels/),
// por eso se permite servir la carpeta de arriba. base "./" sirve para GitHub Pages o Vercel.
export default defineConfig({
  base: "./",
  server: { host: true, fs: { allow: [".."] } },
  build: { target: "es2022" },
});
