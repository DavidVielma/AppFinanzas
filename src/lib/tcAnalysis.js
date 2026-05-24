import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { parseFalabellaStatement } from "./tcParser";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export async function extractPdfText(file) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const rows = new Map();

    textContent.items.forEach((item) => {
      const value = cleanText(item.str);
      if (!value) return;

      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);
      const key = String(y);
      const row = rows.get(key) || [];
      row.push({ x, value });
      rows.set(key, row);
    });

    const lines = Array.from(rows.entries())
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([, row]) =>
        row
          .sort((a, b) => a.x - b.x)
          .map((item) => item.value)
          .join(" ")
      );

    pageTexts.push(lines.join("\n"));
  }

  return pageTexts.join("\n");
}

export { parseFalabellaStatement };
