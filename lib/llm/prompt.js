const ALLOWED_TAB_FIELDS = ['id', 'title', 'url'];

const SYSTEM_SUFFIX = `

Output strict JSON with this exact shape and nothing else:
{
  "clusters": [
    {
      "name": "string (witty cluster name, max 4 words)",
      "emoji": "string (single emoji)",
      "tabIds": [number],
      "vibe": "string (one short sentence)",
      "confidence": "number between 0 and 1"
    }
  ]
}

Every tabId in the input MUST appear in exactly one cluster.`;

export function buildMessages(tabs, customPrompt) {
  const sanitized = (tabs || []).map(t => {
    const o = {};
    for (const k of ALLOWED_TAB_FIELDS) if (k in t) o[k] = t[k];
    return o;
  });
  return [
    { role: 'system', content: (customPrompt || '') + SYSTEM_SUFFIX },
    { role: 'user', content: `Cluster these tabs:\n${JSON.stringify(sanitized)}` }
  ];
}
