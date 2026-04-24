/**
 * Thrown when a PII entity has positions out of bounds for the given text.
 */
export class InvalidEntityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEntityError';
  }
}

/**
 * Thrown when a PDF document is corrupted and cannot be parsed.
 * Validates: Requirement 9.6
 */
export class PDFCorruptedError extends Error {
  constructor(message: string = 'PDF document is corrupted and cannot be parsed') {
    super(message);
    this.name = 'PDFCorruptedError';
  }
}

/**
 * Thrown when a PDF document is password-protected.
 * Validates: Requirement 9.6
 */
export class PDFPasswordProtectedError extends Error {
  constructor(message: string = 'PDF document is password-protected') {
    super(message);
    this.name = 'PDFPasswordProtectedError';
  }
}

/**
 * Thrown when a PDF document exceeds the 50-page limit.
 */
export class PDFPageLimitError extends Error {
  constructor(pageCount: number) {
    super(`PDF document has ${pageCount} pages, exceeding the 50-page limit`);
    this.name = 'PDFPageLimitError';
  }
}

/**
 * Thrown when PDF text extraction exceeds the 3-second timeout.
 */
export class PDFTimeoutError extends Error {
  constructor(message: string = 'PDF text extraction timed out after 3 seconds') {
    super(message);
    this.name = 'PDFTimeoutError';
  }
}
