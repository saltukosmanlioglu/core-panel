import axios from 'axios';

const SH3DO_BASE_URL = process.env.SH3DO_BASE_URL ?? '';
const SH3DO_RETAILER_KEY = process.env.SH3DO_RETAILER_KEY ?? '';

export function isSh3doConfigured(): boolean {
  return SH3DO_BASE_URL.length > 0 && SH3DO_RETAILER_KEY.length > 0;
}

export function generateUserId(companyId: string, projectId: string): string {
  const companySlug = companyId.replace(/-/g, '').slice(0, 8);
  const projectSlug = projectId.replace(/-/g, '').slice(0, 8);
  return `cp_${companySlug}_${projectSlug}`;
}

export function getEditorUrl(userId: string, homeName: string): string {
  const params = new URLSearchParams({
    retailerKey: SH3DO_RETAILER_KEY,
    userId,
    homeName,
  });
  return `${SH3DO_BASE_URL}/?${params.toString()}`;
}

export async function createHome(userId: string, homeName: string, xmlContent: string): Promise<boolean> {
  try {
    await axios.post(
      `${SH3DO_BASE_URL}/api/writeHome/${SH3DO_RETAILER_KEY}/${encodeURIComponent(userId)}/${encodeURIComponent(homeName)}`,
      xmlContent,
      {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 30000,
      },
    );
    return true;
  } catch (error) {
    console.error('[SH3DO] createHome failed', { userId, homeName, error });
    return false;
  }
}

export async function readHome(userId: string, homeName: string): Promise<string | null> {
  try {
    const res = await axios.get(
      `${SH3DO_BASE_URL}/api/readHome/${SH3DO_RETAILER_KEY}/${encodeURIComponent(userId)}/${encodeURIComponent(homeName)}`,
      { responseType: 'text', timeout: 15000 },
    );
    return res.data as string;
  } catch {
    return null;
  }
}

export async function deleteHome(userId: string, homeName: string): Promise<boolean> {
  try {
    await axios.delete(
      `${SH3DO_BASE_URL}/api/deleteHome/${SH3DO_RETAILER_KEY}/${encodeURIComponent(userId)}/${encodeURIComponent(homeName)}`,
      { timeout: 15000 },
    );
    return true;
  } catch (error) {
    console.error('[SH3DO] deleteHome failed', { userId, homeName, error });
    return false;
  }
}
