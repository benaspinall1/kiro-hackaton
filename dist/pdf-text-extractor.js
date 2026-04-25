"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDFTextExtractorImpl = void 0;
const pdf_parse_1 = require("pdf-parse");
const errors_1 = require("./errors");
const MAX_PAGES = 50;
const TIMEOUT_MS = 3000;
/**
 * Extracts text from PDF documents using pdf-parse.
 * Validates: Requirements 9.1, 9.2, 9.3, 9.6, 9.7
 */
class PDFTextExtractorImpl {
    async extract(pdfBuffer) {
        const parser = new pdf_parse_1.PDFParse({ data: new Uint8Array(pdfBuffer) });
        try {
            const result = await this.withTimeout(this.doExtract(parser), TIMEOUT_MS);
            return result;
        }
        catch (error) {
            // Re-throw our custom errors as-is
            if (error instanceof errors_1.PDFCorruptedError ||
                error instanceof errors_1.PDFPasswordProtectedError ||
                error instanceof errors_1.PDFPageLimitError ||
                error instanceof errors_1.PDFTimeoutError) {
                throw error;
            }
            if (error instanceof pdf_parse_1.PasswordException) {
                throw new errors_1.PDFPasswordProtectedError();
            }
            if (error instanceof pdf_parse_1.InvalidPDFException) {
                throw new errors_1.PDFCorruptedError();
            }
            // Catch other pdf-parse errors that indicate corruption
            if (error instanceof Error) {
                const msg = error.message.toLowerCase();
                if (msg.includes('password') || msg.includes('encrypted')) {
                    throw new errors_1.PDFPasswordProtectedError();
                }
                if (msg.includes('invalid') ||
                    msg.includes('corrupt') ||
                    msg.includes('format') ||
                    msg.includes('pdf')) {
                    throw new errors_1.PDFCorruptedError(error.message);
                }
            }
            throw new errors_1.PDFCorruptedError(error instanceof Error ? error.message : 'Unknown PDF parsing error');
        }
        finally {
            try {
                await parser.destroy();
            }
            catch {
                // Ignore cleanup errors
            }
        }
    }
    async doExtract(parser) {
        const textResult = await parser.getText({ pageJoiner: '\n' });
        const pageCount = textResult.total;
        if (pageCount > MAX_PAGES) {
            throw new errors_1.PDFPageLimitError(pageCount);
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
    withTimeout(promise, ms) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new errors_1.PDFTimeoutError());
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
exports.PDFTextExtractorImpl = PDFTextExtractorImpl;
//# sourceMappingURL=pdf-text-extractor.js.map