export function resolveParams(params, context) {
  if (!params) return params;
  if (typeof params === 'string') {
    return params.replace(/\$\{(\w+)\}/g, (_match, key) => {
      return context[key] !== undefined ? String(context[key]) : _match;
    });
  }
  if (typeof params === 'object' && params !== null) {
    const resolved = Array.isArray(params) ? [] : {};
    for (const [key, value] of Object.entries(params)) {
      resolved[key] = resolveParams(value, context);
    }
    return resolved;
  }
  return params;
}
