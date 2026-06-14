/**
 * Convert HTML to plain, readable text, extracting the page title.
 */
export function htmlToText(html: string): { title: string | null; text: string } {
  // Extract <title>...</title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() || null : null;

  let body = html;

  // Remove script, style, noscript blocks (including their contents)
  body = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  body = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  body = body.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Remove HTML comments
  body = body.replace(/<!--[\s\S]*?-->/g, '');

  // Convert block-ish tags to newlines
  body = body.replace(/<\/p\s*>/gi, '\n');
  body = body.replace(/<br\s*\/?>/gi, '\n');
  body = body.replace(/<\/div\s*>/gi, '\n');
  body = body.replace(/<\/h[1-6]\s*>/gi, '\n');
  body = body.replace(/<\/li\s*>/gi, '\n');
  body = body.replace(/<\/tr\s*>/gi, '\n');

  // Strip all remaining tags
  body = body.replace(/<[^>]+>/g, '');

  // Decode entities
  body = decodeEntities(body);

  // Collapse 3+ blank lines to 2, trim trailing spaces per line, trim overall
  body = body
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
  body = body.replace(/\n{3,}/g, '\n\n');
  body = body.trim();

  return { title, text: body };
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return '';
      }
    });
}
