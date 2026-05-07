import { env } from '../config/env';
import { AppError } from '../lib/AppError';

const CLAUDE_MODEL = 'claude-sonnet-4-6';

export interface FloorPlanGeneratorParams {
  totalArea: number;
  apartmentCount: number;
  roomType: string;
  projectName: string;
  constraints?: {
    onBahce?: number | null;
    yanBahce?: number | null;
    arkaBahce?: number | null;
    buildableWidth?: number | null;
    buildableDepth?: number | null;
  };
}

function buildRoomDescription(roomType: string): string {
  switch (roomType) {
    case 'studio': return 'stüdyo daire (tek oda + banyo + mutfak)';
    case '1+1': return '1 yatak odası + salon + mutfak + banyo + wc';
    case '2+1': return '2 yatak odası + salon + mutfak + banyo + wc + koridor';
    case '3+1': return '3 yatak odası + salon + mutfak + banyo + wc + koridor';
    case '4+1': return '4 yatak odası + salon + mutfak + 2x banyo + wc + koridor';
    default: return `${roomType} daire`;
  }
}

function extractXml(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('<?xml')) return trimmed;

  const fenceMatch = trimmed.match(/```(?:xml)?\s*([\s\S]+?)```/);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  const xmlStart = trimmed.indexOf('<?xml');
  if (xmlStart >= 0) return trimmed.slice(xmlStart);

  throw new AppError('Claude geçerli XML üretmedi', 502, 'FLOOR_PLAN_XML_MISSING');
}

async function callClaude(
  client: InstanceType<typeof import('@anthropic-ai/sdk').default>,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('\n')
    .trim();

  return extractXml(text);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateFloorPlanXml(params: FloorPlanGeneratorParams): Promise<string> {
  const sdk = require('@anthropic-ai/sdk') as typeof import('@anthropic-ai/sdk');
  const Anthropic = sdk.default;
  const { RateLimitError } = sdk;
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const roomDesc = buildRoomDescription(params.roomType);
  const constraintLines = [
    params.constraints?.onBahce != null ? `  - Ön bahçe mesafesi: ${params.constraints.onBahce}m` : null,
    params.constraints?.yanBahce != null ? `  - Yan bahçe mesafesi: ${params.constraints.yanBahce}m` : null,
    params.constraints?.arkaBahce != null ? `  - Arka bahçe mesafesi: ${params.constraints.arkaBahce}m` : null,
    params.constraints?.buildableWidth != null ? `  - İnşaat genişliği: ${params.constraints.buildableWidth}m` : null,
    params.constraints?.buildableDepth != null ? `  - İnşaat derinliği: ${params.constraints.buildableDepth}m` : null,
  ].filter(Boolean).join('\n');

  const systemPrompt = `Sen uzman bir Türk mimarısın. Sweet Home 3D (SH3D) XML formatında kat planı üretiyorsun.

Kurallar:
- Tüm ölçüler santimetre cinsinden (1 metre = 100 birim)
- Daire başına toplam alan: ${params.totalArea} m²
- Kat başına daire sayısı: ${params.apartmentCount} (simetrik yerleştir)
- Daire tipi: ${roomDesc}
- Merkezi merdiven/asansör çekirdeği daireler arasında
- Her dairede kapılar ve pencereler ekle (balkona giden kapı salon duvarında)
- Dış duvar kalınlığı: 20cm, iç duvar kalınlığı: 15cm
- Tavan yüksekliği: 280cm
- Sadece geçerli SH3D Home XML döndür, açıklama yok, markdown yok.
- <?xml version='1.0' encoding='UTF-8'?> ile başla
- XML eksiksiz ve geçerli olmalı.`;

  const userMessage = `Şu bilgilere göre kat planı XML'i üret:
- Proje: ${params.projectName}
- Daire başına alan: ${params.totalArea} m²
- Daire tipi: ${params.roomType} (${roomDesc})
- Kat başına daire sayısı: ${params.apartmentCount}
${constraintLines ? `Kısıtlar:\n${constraintLines}` : ''}

Eksiksiz SH3D XML döndür.`;

  try {
    return await callClaude(client, systemPrompt, userMessage);
  } catch (firstError) {
    if (firstError instanceof AppError) throw firstError;

    if (firstError instanceof RateLimitError) {
      // Wait 30 s then retry once
      console.warn('[FloorPlanGenerator] Rate limited — retrying in 30 s');
      await sleep(30_000);
      try {
        return await callClaude(client, systemPrompt, userMessage);
      } catch (retryError) {
        if (retryError instanceof RateLimitError) {
          throw new AppError(
            'Claude API şu an yoğun. Lütfen 1-2 dakika bekleyip tekrar deneyin.',
            429,
            'FLOOR_PLAN_RATE_LIMITED',
          );
        }
        throw new AppError(
          `Kat planı üretimi başarısız: ${retryError instanceof Error ? retryError.message : 'Bilinmeyen hata'}`,
          502,
          'FLOOR_PLAN_GENERATION_FAILED',
        );
      }
    }

    console.error('[FloorPlanGenerator] Claude call failed', { error: firstError });
    throw new AppError(
      `Kat planı üretimi başarısız: ${firstError instanceof Error ? firstError.message : 'Bilinmeyen hata'}`,
      502,
      'FLOOR_PLAN_GENERATION_FAILED',
    );
  }
}
