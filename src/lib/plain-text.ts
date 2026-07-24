const EMOJI_PATTERN = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D\u20E3]/gu;
const DECORATIVE_SYMBOL_PATTERN = /[◆◇■□●○▲△▼▽★☆※✓✔✦✧•]/g;

/**
 * Converts model output into plain text suitable for both chat display and TTS.
 */
export function sanitizeSpeechText(input: string): string {
  return input
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*```[^\n]*$/gm, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-+*]\s+/gm, '')
    .replace(/^\s{0,3}\d+[.)]\s+/gm, '')
    .replace(/^\s{0,3}(?:[-*_]\s*){3,}$/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[\*`]/g, '')
    .replace(/~~|__/g, '')
    .replace(EMOJI_PATTERN, '')
    .replace(DECORATIVE_SYMBOL_PATTERN, '');
}
