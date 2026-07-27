import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export interface ExtractedSubject {
  name: string;
  weight: number;
  topics: string[];
}

/**
 * Extrai texto completo de um arquivo PDF
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

/**
 * Tenta parsear matérias e tópicos a partir do texto do edital.
 * Heurística: identifica padrões comuns em editais brasileiros.
 */
export function parseEditalText(text: string): ExtractedSubject[] {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2);

  const subjects: ExtractedSubject[] = [];
  let currentSubject: ExtractedSubject | null = null;

  // Padrões comuns de cabeçalho de matéria em editais
  const subjectPatterns = [
    /^(\d+[\.\-]?\s+)?([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜ\s\/]+)[\s:]*(\d+[\.,]\d*\s*%|\(\d+\s*(pontos?|questões?)\))?/,
  ];

  // Padrões de peso/porcentagem
  const weightPattern = /(\d+[\.,]\d*)\s*%|(\d+)\s*(pontos?|questões?)/i;

  for (const line of lines) {
    // Detecta se é um cabeçalho de matéria (maiúsculas, curto, pode ter %)
    const isAllCaps = line === line.toUpperCase() && line.length > 3 && line.length < 80;
    const hasWeight = weightPattern.test(line);
    const isNumberedItem = /^\d+[\.\)]\s+.+/.test(line);

    if (isAllCaps || (hasWeight && line.length < 100)) {
      // Extrai peso
      let weight = 0;
      const wMatch = line.match(/(\d+[\.,]\d*)\s*%/);
      if (wMatch) {
        weight = parseFloat(wMatch[1].replace(',', '.'));
      }

      // Limpa o nome
      const name = line
        .replace(/\d+[\.,]\d*\s*%/, '')
        .replace(/\(\d+.*?\)/, '')
        .replace(/^\d+[\.\-\s]+/, '')
        .trim();

      if (name.length > 2) {
        if (currentSubject) subjects.push(currentSubject);
        currentSubject = { name, weight, topics: [] };
      }
    } else if (currentSubject && line.length > 3 && line.length < 200) {
      // É um tópico da matéria atual
      const topic = line
        .replace(/^\d+[\.\)\-\s]+/, '')
        .replace(/^[a-z][\.\)]\s+/, '')
        .trim();

      if (topic.length > 2 && !topic.match(/^[\.;,\-]/)) {
        currentSubject.topics.push(topic);
      }
    }
  }

  if (currentSubject) subjects.push(currentSubject);

  // Garante que os pesos somem 100 se não foram definidos
  const totalWeight = subjects.reduce((s, sub) => s + sub.weight, 0);
  if (totalWeight === 0) {
    const perSubject = parseFloat((100 / subjects.length).toFixed(1));
    subjects.forEach(s => { s.weight = perSubject; });
  }

  return subjects.filter(s => s.topics.length > 0 || s.name.length > 2);
}
