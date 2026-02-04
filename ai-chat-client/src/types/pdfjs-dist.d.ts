declare module "pdfjs-dist/build/pdf" {
  export const GlobalWorkerOptions: { workerSrc?: string };
  export function getDocument(src: { data: ArrayBuffer }): { promise: Promise<unknown> };
}

