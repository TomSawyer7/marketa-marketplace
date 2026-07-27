import { createWorker } from 'tesseract.js';
import type { NationalIdFields } from '../types/marketplace';

export interface OcrExtractionResult {
  rawText: string;
  fields: Partial<NationalIdFields>;
  confidence: Partial<Record<keyof NationalIdFields, number>>;
}

export const ID_FIELD_PATTERNS = {
  id_number: [
    /(?:ID|NO|NUM|NUMBER|DOCUMENT|REF)[:\s#-]*([A-Z0-9][A-Z0-9\s-]{4,20})/i,
    /(?:ID|NO|NUM|NUMBER|DOCUMENT|REF)[.:\s]*([A-Z0-9][A-Z0-9\s-]{3,18})/i,
    /\b([A-Z]{1,4}[- ]?\d{5,12}|\d{6,14})\b/
  ],
  date_of_birth: [
    /(?:DOB|BIRTH|BORN|DATE OF BIRTH|DATE[./-]OF[./-]BIRTH)[:\s]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
    /(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4})/,
    /(\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2})/
  ],
  expiry_date: [
    /(?:EXP|EXPIRY|EXPIRES|EXPIRATION|VALID UNTIL|VALID THRU|DATE OF EXPIRY)[:\s]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
    /(?:EXP|EXPIRY|EXPIRES)[.:\s]*(\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4})/i
  ],
  nationality: [
    /(?:NAT|NATIONALITY|CITIZENSHIP|COUNTRY|NATIONAL)[:\s]*([A-Za-z\s-]{3,25})/i,
    /\b(UNITED STATES|USA|US|CANADA|UNITED KINGDOM|UK|GERMANY|FRANCE|SINGAPORE|JAPAN|KOREA|INDIA|MEXICO|AUSTRALIA)\b/i
  ],
  full_name: [
    /(?:NAME|FULL NAME|SURNAME|LAST NAME|FIRST NAME|GIVEN NAME|FAMILY NAME)[:\s]*([A-Za-z\s'-]{3,40})/i,
    /(?:NAME|FULL NAME|SURNAME|LAST NAME)[.:\s]*([A-Za-z\s'-]{3,40})/i
  ]
};

export function parseFieldsFromText(text: string, overallConfidence: number): {
  fields: Partial<NationalIdFields>;
  confidence: Partial<Record<keyof NationalIdFields, number>>;
} {
  const fields: Partial<NationalIdFields> = {};
  const confidence: Partial<Record<keyof NationalIdFields, number>> = {};

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const pattern of ID_FIELD_PATTERNS.id_number) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const val = match[1].trim().replace(/\s+/g, '');
      if (val.length >= 4 && val.length <= 20) {
        fields.id_number = val;
        confidence.id_number = Math.min(Math.round(overallConfidence * 0.95), 98);
        break;
      }
    }
  }

  for (const pattern of ID_FIELD_PATTERNS.date_of_birth) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const val = match[1].trim();
      if (/^[\d\/\.-]+$/.test(val) && val.length >= 8) {
        fields.date_of_birth = val;
        confidence.date_of_birth = Math.min(Math.round(overallConfidence * 0.90), 95);
        break;
      }
    }
  }

  for (const pattern of ID_FIELD_PATTERNS.expiry_date) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const val = match[1].trim();
      if (/^[\d\/\.-]+$/.test(val) && val.length >= 8 && val !== fields.date_of_birth) {
        fields.expiry_date = val;
        confidence.expiry_date = Math.min(Math.round(overallConfidence * 0.88), 92);
        break;
      }
    }
  }

  for (const pattern of ID_FIELD_PATTERNS.nationality) {
    const match = text.match(pattern);
    if (match && match[1]) {
      fields.nationality = match[1].trim().toUpperCase();
      confidence.nationality = Math.min(Math.round(overallConfidence * 0.92), 96);
      break;
    }
  }

  for (const pattern of ID_FIELD_PATTERNS.full_name) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const val = match[1].trim().replace(/\s+/g, ' ').replace(/[^A-Za-z\s'-]/g, '');
      if (val.length >= 3 && val.split(/\s+/).length >= 1) {
        fields.full_name = val;
        confidence.full_name = Math.min(Math.round(overallConfidence * 0.85), 90);
        break;
      }
    }
  }

  // Fallback heuristic for Name if pattern didn't match
  if (!fields.full_name && lines.length > 0) {
    for (const line of lines) {
      const clean = line.replace(/[^A-Za-z\s]/g, '').trim();
      if (
        clean.length >= 5 &&
        /[A-Za-z]/.test(clean) &&
        !/NATIONAL|IDENTITY|CARD|REPUBLIC|GOV|DOCUMENT|ID\b|NO\b|BIRTH|SEX|MALE|FEMALE|ISSUE|SIGNATURE|PHOTO|IMAGE/.test(clean.toUpperCase())
      ) {
        const words = clean.split(/\s+/).filter(w => w.length >= 2);
        if (words.length >= 2 && words.length <= 4) {
          const capitalized = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
          fields.full_name = capitalized;
          confidence.full_name = Math.round(overallConfidence * 0.50);
          break;
        }
      }
    }
  }

  return { fields, confidence };
}

function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image for OCR'));
    img.src = dataUrl;
  });
}

export async function extractIdFields(imageSource: string): Promise<OcrExtractionResult> {
  let worker = null;
  try {
    const image = await dataUrlToImage(imageSource);
    worker = await createWorker('eng');
    const ret = await worker.recognize(image);
    const rawText = ret.data.text;
    const overallConfidence = ret.data.confidence || 75;

    await worker.terminate();

    const { fields, confidence } = parseFieldsFromText(rawText, overallConfidence);

    return {
      rawText,
      fields,
      confidence
    };
  } catch (err) {
    console.warn('Tesseract OCR engine error:', err);
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        // ignore cleanup error
      }
    }

    return {
      rawText: '',
      fields: {},
      confidence: {}
    };
  }
}
