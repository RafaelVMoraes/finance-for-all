interface PdfJsPage {
  getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
}

interface PdfJsDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
}

async function extractWithPdfParse(buffer: ArrayBuffer): Promise<string> {
  const moduleName = 'pdf-parse';
  const mod = await import(/* @vite-ignore */ moduleName);
  const parser = (mod.default || mod) as (dataBuffer: Uint8Array) => Promise<{ text: string }>;
  const result = await parser(new Uint8Array(buffer));
  return result.text || '';
}

async function extractWithPdfJs(buffer: ArrayBuffer): Promise<string> {
  const moduleName = 'pdfjs-dist';
  const pdfjs = await import(/* @vite-ignore */ moduleName);
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const doc = (await loadingTask.promise) as PdfJsDocument;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => item.str || '')
      .join(' ')
      .trim();

    pages.push(pageText);
  }

  return pages.join('\n');
}

export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let rawText = '';

  try {
    rawText = await extractWithPdfParse(buffer);
  } catch (error) {
    console.warn('[PDF_PARSE_PRIMARY_FAILED]', error);
    rawText = await extractWithPdfJs(buffer);
  }

  return rawText
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
