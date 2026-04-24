import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PDFCorruptedError,
  PDFPasswordProtectedError,
  PDFPageLimitError,
  PDFTimeoutError,
} from './errors';

// Mock pdf-parse module
const mockGetText = vi.fn();
const mockDestroy = vi.fn().mockResolvedValue(undefined);

vi.mock('pdf-parse', () => {
  class MockPDFParse {
    constructor(_options: unknown) {}
    getText = mockGetText;
    destroy = mockDestroy;
  }

  class InvalidPDFException extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'InvalidPDFException';
    }
  }

  class PasswordException extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'PasswordException';
    }
  }

  return {
    PDFParse: MockPDFParse,
    InvalidPDFException,
    PasswordException,
  };
});

import { PDFTextExtractorImpl } from './pdf-text-extractor';

describe('PDFTextExtractorImpl', () => {
  let extractor: PDFTextExtractorImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    extractor = new PDFTextExtractorImpl();
  });

  it('should extract text from a valid PDF', async () => {
    mockGetText.mockResolvedValue({
      text: 'Hello World\nPage two content',
      total: 2,
      pages: [],
    });

    const result = await extractor.extract(Buffer.from('fake-pdf'));

    expect(result).toEqual({
      text: 'Hello World\nPage two content',
      pageCount: 2,
      extractable: true,
    });
  });

  it('should throw PDFCorruptedError for corrupted PDF buffer', async () => {
    const { InvalidPDFException } = await import('pdf-parse');
    mockGetText.mockRejectedValue(new InvalidPDFException('Invalid PDF structure'));

    await expect(extractor.extract(Buffer.from('corrupted'))).rejects.toThrow(
      PDFCorruptedError,
    );
  });

  it('should throw PDFPasswordProtectedError for password-protected PDF', async () => {
    const { PasswordException } = await import('pdf-parse');
    mockGetText.mockRejectedValue(new PasswordException('Need password'));

    await expect(extractor.extract(Buffer.from('encrypted-pdf'))).rejects.toThrow(
      PDFPasswordProtectedError,
    );
  });

  it('should return extractable: false for image-only PDF (empty text)', async () => {
    mockGetText.mockResolvedValue({
      text: '',
      total: 3,
      pages: [],
    });

    const result = await extractor.extract(Buffer.from('image-only-pdf'));

    expect(result).toEqual({
      text: '',
      pageCount: 3,
      extractable: false,
    });
  });

  it('should return extractable: false for whitespace-only text', async () => {
    mockGetText.mockResolvedValue({
      text: '   \n\t  \n  ',
      total: 1,
      pages: [],
    });

    const result = await extractor.extract(Buffer.from('whitespace-pdf'));

    expect(result).toEqual({
      text: '',
      pageCount: 1,
      extractable: false,
    });
  });

  it('should throw PDFPageLimitError for PDF exceeding 50 pages', async () => {
    mockGetText.mockResolvedValue({
      text: 'Some text',
      total: 51,
      pages: [],
    });

    await expect(extractor.extract(Buffer.from('large-pdf'))).rejects.toThrow(
      PDFPageLimitError,
    );

    try {
      await extractor.extract(Buffer.from('large-pdf'));
    } catch (error) {
      expect(error).toBeInstanceOf(PDFPageLimitError);
      expect((error as PDFPageLimitError).message).toContain('51');
      expect((error as PDFPageLimitError).message).toContain('50');
    }
  });

  it('should throw PDFTimeoutError when extraction exceeds 3 seconds', async () => {
    mockGetText.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000)),
    );

    await expect(extractor.extract(Buffer.from('slow-pdf'))).rejects.toThrow(
      PDFTimeoutError,
    );
  }, 10000);

  it('should handle exactly 50 pages without error', async () => {
    mockGetText.mockResolvedValue({
      text: 'Content from 50 pages',
      total: 50,
      pages: [],
    });

    const result = await extractor.extract(Buffer.from('fifty-page-pdf'));

    expect(result).toEqual({
      text: 'Content from 50 pages',
      pageCount: 50,
      extractable: true,
    });
  });

  it('should throw PDFPasswordProtectedError for errors with password-related messages', async () => {
    mockGetText.mockRejectedValue(new Error('Document is encrypted'));

    await expect(extractor.extract(Buffer.from('encrypted'))).rejects.toThrow(
      PDFPasswordProtectedError,
    );
  });

  it('should throw PDFCorruptedError for unknown errors', async () => {
    mockGetText.mockRejectedValue(new Error('Something went wrong'));

    await expect(extractor.extract(Buffer.from('bad'))).rejects.toThrow(
      PDFCorruptedError,
    );
  });
});
