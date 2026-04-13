const { defineConfig } = require("vite");
const path = require("path");

module.exports = defineConfig(async () => {
  const react = (await import("@vitejs/plugin-react")).default;

  return {
    root: path.resolve(__dirname, "renderer"),
    base: "./",
    plugins: [react()],
    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
    },
  };
});
