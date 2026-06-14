import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { scanDir } from '../../lib/scan-dir.js';

export function loadSpec(specFile) {
  try {
    const raw = readFileSync(specFile, 'utf-8');
    const parsed = /\.ya?ml$/i.test(specFile) ? yaml.load(raw) : JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

const OPENAPI_PATTERNS = [
  'openapi.json', 'openapi.yaml', 'openapi.yml',
  'swagger.json', 'swagger.yaml', 'swagger.yml',
  'api-spec.json', 'api-spec.yaml', 'api-spec.yml',
  'spec.json', 'spec.yaml', 'spec.yml',
  'docs/openapi.json', 'docs/openapi.yaml', 'docs/openapi.yml',
  'public/openapi.json', 'public/openapi.yaml', 'public/openapi.yml',
  'src/openapi.json', 'src/openapi.yaml', 'src/openapi.yml',
];

export function findOpenApiSpec(root) {
  for (const pattern of OPENAPI_PATTERNS) {
    const full = join(root, pattern);
    if (existsSync(full)) return full;
  }
  const deep = scanDir(root, {
    filter: f => /openapi\.(json|ya?ml)$|swagger\.(json|ya?ml)$|api-spec\.(json|ya?ml)$/i.test(f),
  });
  return deep.length > 0 ? deep[0] : null;
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head']);

export function extractEndpoints(spec) {
  const endpoints = new Map();
  const paths = spec.paths || {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    const pathParams = pathItem.parameters || [];
    for (const [method, op] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      if (!op || typeof op !== 'object') continue;

      const key = `${method.toUpperCase()}:${path}`;
      const schemaFields = collectEndpointFields(op, spec, pathParams);
      endpoints.set(key, {
        method: method.toUpperCase(), path,
        operationId: op.operationId || null,
        schemaFields,
      });
    }
  }
  return endpoints;
}

function collectEndpointFields(op, spec, pathParams = []) {
  const fields = [];
  const bodyContent = op.requestBody?.content || {};
  const bodySchema =
    bodyContent['application/json']?.schema ||
    bodyContent['application/x-www-form-urlencoded']?.schema;
  if (bodySchema) {
    fields.push(...extractSchemaFields(bodySchema, spec));
  }
  const allParams = [...pathParams, ...(op.parameters || [])];
  for (const p of allParams) {
    if (p.name) fields.push(p.name);
  }
  return fields;
}

export function extractSchemas(spec) {
  const schemas = new Set();
  const components = spec.components?.schemas || spec.definitions || {};
  for (const name of Object.keys(components)) {
    schemas.add(name);
    const props = components[name]?.properties || {};
    for (const field of Object.keys(props)) {
      schemas.add(`${name}.${field}`);
    }
  }
  return schemas;
}

function resolveSchemaRef(schemaRef, spec) {
  if (!schemaRef.$ref) return schemaRef;
  const pointer = schemaRef.$ref;
  if (!pointer.startsWith('#/')) return null;
  const segments = pointer.slice(2).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  let resolved = spec;
  for (const seg of segments) {
    resolved = resolved?.[seg];
    if (!resolved) return null;
  }
  return resolved;
}

function extractSchemaFields(schema, spec) {
  if (!schema) return [];
  const resolved = resolveSchemaRef(schema, spec);
  if (!resolved) return [];
  const fields = [];
  if (resolved.properties) fields.push(...Object.keys(resolved.properties));
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    if (Array.isArray(resolved[key])) {
      for (const sub of resolved[key]) {
        fields.push(...extractSchemaFields(sub, spec));
      }
    }
  }
  return fields;
}

export function normalizePath(p) {
  let result = '';
  let prev = '';
  for (const ch of p.toLowerCase()) {
    if (ch === '/' && prev === '/') continue;
    result += ch;
    prev = ch;
  }
  if (result.endsWith('/') && result.length > 1) result = result.slice(0, -1);
  return result;
}

export function matchEndpoint(call, methodIndex) {
  const callNorm = normalizePath(call.path);

  const exact = methodIndex.get(callNorm) || [];
  for (const c of exact) {
    if (c.method === call.method || call.method === 'GET') {
      return { matched: true, schemaFields: c.schemaFields };
    }
  }

  return matchTemplateEndpoint(call, callNorm, methodIndex);
}

function matchTemplateEndpoint(call, callNorm, methodIndex) {
  for (const [normPath, candidates] of methodIndex) {
    if (!normPath.includes('{')) continue;
    const segments = normPath.split('/');
    const callSegs = callNorm.split('/');
    if (segments.length !== callSegs.length) continue;
    if (!segmentsMatch(segments, callSegs)) continue;
    for (const c of candidates) {
      if (c.method === call.method || call.method === 'GET') {
        return { matched: true, schemaFields: c.schemaFields };
      }
    }
  }
  return null;
}

function segmentsMatch(template, concrete) {
  for (let i = 0; i < template.length; i++) {
    if (template[i].startsWith('{')) continue;
    if (template[i] !== concrete[i]) return false;
  }
  return true;
}
