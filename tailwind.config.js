/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./renderer/index.html", "./renderer/src/**/*.{js,ts,jsx,tsx}", "./src/ui/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
