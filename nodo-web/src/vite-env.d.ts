/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// BarcodeDetector API (Chrome Android, Edge). No está en lib.dom.d.ts aún.
declare global {
  interface BarcodeDetectorOptions {
    formats: string[];
  }
  interface DetectedBarcode {
    rawValue: string;
    format: string;
  }
  class BarcodeDetector {
    constructor(options?: BarcodeDetectorOptions);
    detect(image: CanvasImageSource): Promise<DetectedBarcode[]>;
    static getSupportedFormats(): Promise<string[]>;
  }
}

export {};
