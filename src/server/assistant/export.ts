import "server-only";

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function createDocxExport(title: string, content: string) {
  const children = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
    ...content.split(/\n{2,}/).map(
      (paragraph) =>
        new Paragraph({
          children: [new TextRun({ text: paragraph.trim(), size: 22 })],
          spacing: { after: 180, line: 300 },
        }),
    ),
    new Paragraph({
      children: [
        new TextRun({
          text: "Prepared with WAYFOUND · Review every fact before use.",
          italics: true,
          size: 18,
        }),
      ],
      spacing: { before: 260 },
    }),
  ];
  return Packer.toBuffer(new Document({ sections: [{ properties: {}, children }] }));
}

function wrapLine(text: string, max = 88) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max) {
      if (line) lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
}

export async function createPdfExport(title: string, content: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages: ReturnType<typeof pdf.addPage>[] = [];
  let page = pdf.addPage([595.28, 841.89]);
  pages.push(page);
  let y = 790;
  page.drawText(title, { x: 52, y, size: 18, font: bold, color: rgb(0.04, 0.1, 0.17) });
  y -= 34;
  for (const paragraph of content.split(/\n{2,}/)) {
    for (const line of wrapLine(paragraph)) {
      if (y < 64) {
        page = pdf.addPage([595.28, 841.89]);
        pages.push(page);
        y = 790;
      }
      page.drawText(line, { x: 52, y, size: 10.5, font, color: rgb(0.09, 0.13, 0.17) });
      y -= 15;
    }
    y -= 10;
  }
  for (const item of pages)
    item.drawText("Prepared with WAYFOUND · Review every fact before use.", {
      x: 52,
      y: 34,
      size: 8,
      font,
      color: rgb(0.39, 0.45, 0.53),
    });
  return Buffer.from(await pdf.save());
}
