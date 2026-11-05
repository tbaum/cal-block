import type { CalBlockApi } from "../preload/index.ts";

declare global {
  interface Window {
    calBlock: CalBlockApi;
  }
}

const versionLabel = document.querySelector<HTMLParagraphElement>("#version");
void window.calBlock.version().then((version) => {
  if (versionLabel) versionLabel.textContent = `Version ${version}`;
});
