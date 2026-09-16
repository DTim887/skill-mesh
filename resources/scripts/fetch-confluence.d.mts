// Sibling ambient declaration so TypeScript (test/tsconfig.json) can type-check imports of this
// plain-JS ESM file. This file is NOT part of what `init` copies to a user's workspace — only
// `fetch-confluence.mjs` itself is.
export declare function extractPageId(url: string): string | undefined
export declare function buildApiUrl(url: string, pageId: string): string
export declare function stripHtml(html: string): string
export declare function main(url: string): Promise<void>
