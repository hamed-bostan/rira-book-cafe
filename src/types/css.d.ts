declare module "*.css";

// Swiper's stylesheet entry points are package subpaths (not `*.css`), so they
// need their own side-effect-import declarations.
declare module "swiper/css";
declare module "swiper/css/*";
