import packageJson from "@/package.json";

/**
 * The running build's version: `APP_VERSION` when the image was built with one
 * (e.g. the git SHA — see the Dockerfile), else the `package.json` version.
 */
export const APP_VERSION: string = process.env.APP_VERSION || packageJson.version;
