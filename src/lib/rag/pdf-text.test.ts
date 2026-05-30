import { describe, expect, it } from "vitest";
import {
  PdfTextExtractionError,
  extractPdfTextFromBase64,
} from "./pdf-text";

const simplePdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 68 >>
stream
BT
/F1 24 Tf
100 700 Td
(Quarterly PDF RAG smoke test) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000311 00000 n 
trailer
<< /Root 1 0 R /Size 6 >>
startxref
430
%%EOF`;

describe("extractPdfTextFromBase64", () => {
  it("extracts selectable text from a PDF", async () => {
    const result = await extractPdfTextFromBase64(
      Buffer.from(simplePdf, "utf8").toString("base64"),
    );

    expect(result.text).toContain("Quarterly PDF RAG smoke test");
    expect(result.characters).toBeGreaterThan(result.text.length - 1);
    expect(result.truncated).toBe(false);
  });

  it("rejects empty PDF data", async () => {
    await expect(extractPdfTextFromBase64("")).rejects.toBeInstanceOf(
      PdfTextExtractionError,
    );
  });
});
