/**
 * Internal-only tool argument keys that must never be accepted from external
 * MCP clients. These markers (e.g. `__frontagentSecurityApproved`) are set
 * exclusively by the trusted executor after a real security decision; honoring
 * them from raw client arguments would let any caller bypass write-approval
 * gates. They are stripped at the MCP server boundary before dispatch.
 */
const INTERNAL_KEY_PREFIX = '__frontagent';

/**
 * Return a shallow copy of the tool arguments with any internal-only keys
 * removed. Accepts the raw `arguments` object from a CallTool request.
 */
export function stripInternalArgs(
  args: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!args || typeof args !== 'object') return {};

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (key.startsWith(INTERNAL_KEY_PREFIX)) continue;
    sanitized[key] = value;
  }
  return sanitized;
}
