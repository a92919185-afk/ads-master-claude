// Centralized formatting utilities — single source of truth

const currencyFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const currencyCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const decimal2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const decimal1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const percentFmt = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1 });
const intBR = new Intl.NumberFormat('pt-BR');

/** $1,234.56 */
export const fmtCurrency = (v: number) => currencyFull.format(v);

/** $1,235 (no decimals) */
export const fmtCurrencyCompact = (v: number) => currencyCompact.format(v);

/** 1,234.56 */
export const fmtDecimal = (v: number) => decimal2.format(v);

/** 1,234.5 */
export const fmtDecimal1 = (v: number) => decimal1.format(v);

/** 45.2% (input is already a percentage number, e.g. 45.2) */
export const fmtPercent = (v: number) => percentFmt.format(v / 100);

/** 1.234 (pt-BR integer) */
export const fmtIntBR = (v: number) => intBR.format(v);
