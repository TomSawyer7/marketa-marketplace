import type { NationalIdFields } from '../types/marketplace';

export interface OcrExtractionResult {
  rawText: string;
  fields: Partial<NationalIdFields>;
  confidence: Partial<Record<keyof NationalIdFields, number>>;
}

export interface ExtractIdOptions {
  frontImage: string;
  backImage?: string;
}

/**
 * Extract ID fields from front (and optionally back) ID card images
 * by calling the server-side /api/extract-id route which proxies to
 * ID Analyzer Core API v2.
 *
 * Falls back to empty fields if the API call fails so the user can
 * fill in the form manually.
 */
export async function extractIdFields(
  imageSource: string,
  options?: Omit<ExtractIdOptions, 'frontImage'>,
): Promise<OcrExtractionResult> {
  const body: ExtractIdOptions = {
    frontImage: imageSource,
    ...(options?.backImage ? { backImage: options.backImage } : {}),
  };

  try {
    const res = await fetch('/api/extract-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[ocrExtraction] API error (${res.status}):`, body);
      return { rawText: '', fields: {}, confidence: {} };
    }

    const data = await res.json();

    return {
      rawText: data.rawText || '',
      fields: data.fields || {},
      confidence: data.confidence || {},
    };
  } catch (err) {
    console.warn('[ocrExtraction] Network error calling /api/extract-id:', err);
    return {
      rawText: '',
      fields: {},
      confidence: {},
    };
  }
}
