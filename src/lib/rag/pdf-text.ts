import { PDFParse } from "pdf-parse";

const MAX_EXTRACTED_TEXT_CHARS = 80_000;

export class PdfTextExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfTextExtractionError";
  }
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export async function extractPdfTextFromBase64(data: string) {
  if (!data.trim()) {
    throw new PdfTextExtractionError("PDF data is empty.");
  }

  const buffer = Buffer.from(data, "base64");
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const text = normalizeExtractedText(result.text ?? "");

    if (!text) {
      throw new PdfTextExtractionError(
        "No selectable text was found in this PDF. It may be scanned or image-only.",
      );
    }

    return {
      text: text.slice(0, MAX_EXTRACTED_TEXT_CHARS),
      characters: text.length,
      truncated: text.length > MAX_EXTRACTED_TEXT_CHARS,
    };
  } finally {
    await parser.destroy();
  }
}
