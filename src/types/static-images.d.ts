// Keep static asset imports typed before Next.js has generated `next-env.d.ts`.
// CI runs ESLint and TypeScript before `next build`, so a fresh checkout does
// not otherwise have Next's generated image module declarations available.
declare module "*.png" {
  import type { StaticImageData } from "next/image";

  const content: StaticImageData;
  export default content;
}

declare module "*.svg" {
  import type { StaticImageData } from "next/image";

  const content: StaticImageData;
  export default content;
}
