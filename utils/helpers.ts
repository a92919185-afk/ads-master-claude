// Shared helper functions

/**
 * Extract product name from campaign name.
 * e.g. "Ozoku - Search - $150" → "Ozoku"
 * e.g. "RYOKO_BR_EXACT_$180" → "RYOKO"
 */
export function extractProductName(campaignName: string): string {
    const clean = campaignName.replace(/\$\s*\d+(\.\d+)?/g, '').trim();
    const parts = clean.split(/\s*[-|_/\\]\s*/).map(p => p.trim()).filter(p => p.length >= 2);
    return parts.length > 0 ? parts[0] : campaignName.trim();
}
