import { defineConfig } from 'vite'

// GitHub Pages serves the site from /anime-explorer/, but locally it runs from the root.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/anime-explorer/' : '/',
}))
