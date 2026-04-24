import { PDFParse, InvalidPDFException, PasswordException } from 'pdf-parse';
import type { PDFExtractionResult } from './types';
import {
  PDFCorruptedError,
  PDFPasswordProtectedError,
  PDFPageLimitError,
  PDFTimeoutError,
} from './errors';

const MAX_PAGES = 50;
const TIMEOUT_MS = 3000;

/**
 * Extracts text from PDF documents using pdf-parse.
 * Validates: Requirements 9.1, 9.2, 9.3, 9.6, 9.7
 */
export class PDFTextExtractorImpl {
  async extract(pdfBuffer: Buffer): Promise<PDFExtractionResult> {
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });

    try {
      const result = await this.withTimeout(
        this.doExtract(parser),
        TIMEOUT_MS,
      );
      return result;
    } catch (error) {
      // Re-throw our custom errors as-is
      if (
        error instanceof PDFCorruptedError ||
        error instanceof PDFPasswordProtectedError ||
        error instanceof PDFPageLimitError ||
        error instanceof PDFTimeoutError
      ) {
        throw error;
      }

      if (error instanceof PasswordException) {
        throw new PDFPasswordProtectedError();
      }

      if (error instanceof InvalidPDFException) {
        throw new PDFCorruptedError();
      }

      // Catch other pdf-parse errors that indicate corruption
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('password') || msg.includes('encrypted')) {
          throw new PDFPasswordProtectedError();
        }
        if (
          msg.includes('invalid') ||
          msg.includes('corrupt') ||
          msg.includes('format') ||
          msg.includes('pdf')
        ) {
          throw new PDFCorruptedError(error.message);
        }
      }

      throw new PDFCorruptedError(
        error instanceof Error ? error.message : 'Unknown PDF parsing error',
      );
    } finally {
      try {
        await parser.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async doExtract(parser: PDFParse): Promise<PDFExtractionResult> {
    const textResult = await parser.getText({ pageJoiner: '\n' });
    const pageCount = textResult.total;

    if (pageCount > MAX_PAGES) {
      throw new PDFPageLimitError(pageCount);
    }

    const text = textResult.text;

    // Image-only PDFs produce empty or whitespace-only text
    if (!text || text.trim().length === 0) {
      return {
        text: '',
        pageCount,
        extractable: false,
      };
    }

    return {
      text,
      pageCount,
      extractable: true,
    };
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new PDFTimeoutError());
      }, ms);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
