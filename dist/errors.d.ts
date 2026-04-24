/**
 * Thrown when a PII entity has positions out of bounds for the given text.
 */
export declare class InvalidEntityError extends Error {
    constructor(message: string);
}
/**
 * Thrown when a PDF document is corrupted and cannot be parsed.
 * Validates: Requirement 9.6
 */
export declare class PDFCorruptedError extends Error {
    constructor(message?: string);
}
/**
 * Thrown when a PDF document is password-protected.
 * Validates: Requirement 9.6
 */
export declare class PDFPasswordProtectedError extends Error {
    constructor(message?: string);
}
/**
 * Thrown when a PDF document exceeds the 50-page limit.
 */
export declare class PDFPageLimitError extends Error {
    constructor(pageCount: number);
}
/**
 * Thrown when PDF text extraction exceeds the 3-second timeout.
 */
export declare class PDFTimeoutError extends Error {
    constructor(message?: string);
}
//# sourceMappingURL=errors.d.ts.map