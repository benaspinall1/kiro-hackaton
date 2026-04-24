"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDFTimeoutError = exports.PDFPageLimitError = exports.PDFPasswordProtectedError = exports.PDFCorruptedError = exports.InvalidEntityError = void 0;
/**
 * Thrown when a PII entity has positions out of bounds for the given text.
 */
class InvalidEntityError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidEntityError';
    }
}
exports.InvalidEntityError = InvalidEntityError;
/**
 * Thrown when a PDF document is corrupted and cannot be parsed.
 * Validates: Requirement 9.6
 */
class PDFCorruptedError extends Error {
    constructor(message = 'PDF document is corrupted and cannot be parsed') {
        super(message);
        this.name = 'PDFCorruptedError';
    }
}
exports.PDFCorruptedError = PDFCorruptedError;
/**
 * Thrown when a PDF document is password-protected.
 * Validates: Requirement 9.6
 */
class PDFPasswordProtectedError extends Error {
    constructor(message = 'PDF document is password-protected') {
        super(message);
        this.name = 'PDFPasswordProtectedError';
    }
}
exports.PDFPasswordProtectedError = PDFPasswordProtectedError;
/**
 * Thrown when a PDF document exceeds the 50-page limit.
 */
class PDFPageLimitError extends Error {
    constructor(pageCount) {
        super(`PDF document has ${pageCount} pages, exceeding the 50-page limit`);
        this.name = 'PDFPageLimitError';
    }
}
exports.PDFPageLimitError = PDFPageLimitError;
/**
 * Thrown when PDF text extraction exceeds the 3-second timeout.
 */
class PDFTimeoutError extends Error {
    constructor(message = 'PDF text extraction timed out after 3 seconds') {
        super(message);
        this.name = 'PDFTimeoutError';
    }
}
exports.PDFTimeoutError = PDFTimeoutError;
//# sourceMappingURL=errors.js.map