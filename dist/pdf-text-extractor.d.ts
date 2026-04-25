import type { PDFExtractionResult } from './types';
/**
 * Extracts text from PDF documents using pdf-parse.
 * Validates: Requirements 9.1, 9.2, 9.3, 9.6, 9.7
 */
export declare class PDFTextExtractorImpl {
    extract(pdfBuffer: Buffer): Promise<PDFExtractionResult>;
    private doExtract;
    private withTimeout;
}
//# sourceMappingURL=pdf-text-extractor.d.ts.map