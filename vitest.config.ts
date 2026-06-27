import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// 순수 함수 단위테스트 — node 환경, '@' 별칭은 tsconfig paths와 일치.
export default defineConfig({
  test: { environment: "node", include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"] },
  resolve: { alias: { "@": resolve(__dirname, ".") } },
});
