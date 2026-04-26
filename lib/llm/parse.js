import { ClusterParseError } from './errors.js';

export function parseClusters(text) {
  if (!text || typeof text !== 'string') {
    throw new ClusterParseError('Empty or non-string response', text);
  }
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new ClusterParseError('No JSON object found', text);
  }
  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new ClusterParseError(`JSON parse failed: ${e.message}`, text);
  }
  if (!parsed.clusters || !Array.isArray(parsed.clusters)) {
    throw new ClusterParseError('Response missing clusters array', text);
  }
  return parsed.clusters;
}
