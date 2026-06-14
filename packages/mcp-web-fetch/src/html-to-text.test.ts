import { describe, expect, it } from 'vitest';
import { htmlToText } from './html-to-text.js';

describe('htmlToText', () => {
  it('extracts the title', () => {
    const { title } = htmlToText(
      '<html><head><title>Hello World</title></head><body></body></html>',
    );
    expect(title).toBe('Hello World');
  });

  it('returns null title when missing', () => {
    const { title } = htmlToText('<html><body><p>No title here</p></body></html>');
    expect(title).toBeNull();
  });

  it('removes script and style content', () => {
    const html =
      '<html><head><style>body{color:red}</style></head><body><script>alert(1)</script><p>Hi</p></body></html>';
    const { text } = htmlToText(html);
    expect(text).not.toContain('alert');
    expect(text).not.toContain('color:red');
    expect(text).toContain('Hi');
  });

  it('converts <p> and <br> to newlines', () => {
    const html = '<p>Line one</p><p>Line two<br>Line three</p>';
    const { text } = htmlToText(html);
    const lines = text.split('\n');
    expect(lines).toEqual(['Line one', 'Line two', 'Line three']);
  });

  it('decodes common entities', () => {
    const html = '<p>Tom &amp; Jerry&#39;s&nbsp;place</p>';
    const { text } = htmlToText(html);
    expect(text).toBe("Tom & Jerry's place");
  });

  it('handles a combined snippet', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>My &amp; Page</title>
          <style>.x { display: none; }</style>
          <script>console.log('hi');</script>
        </head>
        <body>
          <!-- a comment -->
          <h1>Welcome</h1>
          <p>This is a paragraph with &quot;quotes&quot;.</p>
          <ul>
            <li>Item one</li>
            <li>Item two</li>
          </ul>
        </body>
      </html>
    `;
    const { title, text } = htmlToText(html);
    expect(title).toBe('My & Page');
    expect(text).toContain('Welcome');
    expect(text).toContain('This is a paragraph with "quotes".');
    expect(text).toContain('Item one');
    expect(text).toContain('Item two');
    expect(text).not.toContain('console.log');
    expect(text).not.toContain('display: none');
    expect(text).not.toContain('a comment');
    expect(/\n{3,}/.test(text)).toBe(false);
  });
});
