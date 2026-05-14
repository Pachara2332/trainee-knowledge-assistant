import type { ClientAttachment } from "./types";

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._ -]/g, "").trim().slice(0, 120);
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] ?? "");
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

export async function toClientAttachment(file: File): Promise<ClientAttachment> {
  const name = sanitizeFileName(file.name) || "attachment";
  const lowerName = file.name.toLowerCase();
  const isText = file.type === "text/plain" || lowerName.endsWith(".txt");
  const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");

  if (!isText && !isPdf) {
    throw new Error("Only PDF or TXT files can be attached.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File must be 10MB or smaller.");
  }

  if (isText) {
    return {
      name,
      mimeType: "text/plain",
      text: (await file.text()).slice(0, 40_000),
    };
  }

  return {
    name,
    mimeType: "application/pdf",
    data: await readFileAsBase64(file),
  };
}
