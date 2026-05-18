import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const appRoot = process.cwd();
const srcRoot = path.join(appRoot, 'src');
const langFile = path.join(srcRoot, 'context', 'LanguageContext.tsx');
const outputFile = path.join(srcRoot, 'context', 'translationOverrides.ts');
const reportFile = path.join(appRoot, 'translation-audit-report.json');

const KNOWN_DEFAULTS = {
  'ecommerce.dairaPlaceholder': 'Select daira',
  'ecommerce.communePlaceholder': 'Select commune',
  'inventory.importDescClothing':
    'Upload CSV, Excel, or JSON with product fields like Name, SKU(optional), Barcode, Category, Quantity, Min Quantity, Price, Second Price(optional), Sold % Off(optional), Cost.',
};

const MANUAL_TRANSLATION_OVERRIDES = {
  ar: {
    'invoices.amount': 'المبلغ',
    'invoices.billTo': 'الفاتورة إلى',
    'invoices.downloadPDF': 'تنزيل ملف PDF',
    'invoices.outstanding': 'مستحقة',
    'settings.arabic': 'العربية',
    'settings.noneDash': 'لا يوجد',
    'team.ecommerce': 'الطلبات',
    'team.orders': 'الطلبات',
    'team.role.custom': 'مخصص',
    'team.role.viewer': 'مشاهد',
  },
  fr: {
    'actionCenter.unitsLeftDescription': 'Il ne reste que {{remaining}} unités',
    'invoices.outstanding': 'Impayee',
    'settings.arabic': 'Arabe',
    'settings.noneDash': 'Aucun',
    'team.ecommerce': 'Commandes',
    'team.fullNamePlaceholder': 'Jean Dupont',
    'team.noActivity': 'Aucune activite trouvee pour cette periode',
    'team.ofTotalPlan': 'de {{total}} au total (plan {{plan}})',
    'team.orders': 'Commandes',
    'team.role.custom': 'Personnalise',
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepClone(value) {
  if (Array.isArray(value)) return value.map(deepClone);
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = deepClone(v);
  }
  return out;
}

function deepMerge(base, patch) {
  const out = deepClone(base);
  for (const [k, v] of Object.entries(patch)) {
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = deepClone(v);
    }
  }
  return out;
}

function getPropertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function evalExpression(node, env) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(node) && env[node.text] !== undefined) {
    return deepClone(env[node.text]);
  }
  if (ts.isObjectLiteralExpression(node)) {
    const out = {};
    for (const prop of node.properties) {
      if (ts.isSpreadAssignment(prop)) {
        const spreadValue = evalExpression(prop.expression, env);
        if (isPlainObject(spreadValue)) {
          Object.assign(out, deepClone(spreadValue));
        }
        continue;
      }
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = getPropertyName(prop.name);
      if (!key) continue;
      const value = evalExpression(prop.initializer, env);
      if (value !== undefined) {
        out[key] = value;
      }
    }
    return out;
  }
  return undefined;
}

function flattenObject(obj, prefix = '', out = new Map()) {
  if (!isPlainObject(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v)) {
      flattenObject(v, key, out);
    } else {
      out.set(key, v);
    }
  }
  return out;
}

function getPath(obj, key) {
  const parts = key.split('.');
  let cur = obj;
  for (const part of parts) {
    if (!isPlainObject(cur) || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function setPath(obj, key, value) {
  const parts = key.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!isPlainObject(cur[part])) {
      cur[part] = {};
    }
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}

function extractLiteralKey(node) {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isParenthesizedExpression(node)) {
    return extractLiteralKey(node.expression);
  }
  return undefined;
}

function extractDefaultStrings(node) {
  if (!node) return [];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return [node.text];
  }
  if (ts.isParenthesizedExpression(node)) {
    return extractDefaultStrings(node.expression);
  }
  if (ts.isConditionalExpression(node)) {
    return [...extractDefaultStrings(node.whenTrue), ...extractDefaultStrings(node.whenFalse)];
  }
  if (ts.isObjectLiteralExpression(node)) {
    const out = [];
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = getPropertyName(prop.name);
      if (key === 'defaultValue') {
        out.push(...extractDefaultStrings(prop.initializer));
      }
    }
    return out;
  }
  return [];
}

function addUsage(usages, key, defaults, filePath) {
  if (!usages.has(key)) {
    usages.set(key, { defaults: new Map(), files: new Set() });
  }
  const entry = usages.get(key);
  entry.files.add(filePath);
  for (const value of defaults) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    entry.defaults.set(trimmed, (entry.defaults.get(trimmed) ?? 0) + 1);
  }
}

function walkAst(node, filePath, usages) {
  if (ts.isCallExpression(node)) {
    let isTranslationCall = false;
    if (ts.isIdentifier(node.expression) && node.expression.text === 't') {
      isTranslationCall = true;
    } else if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 't') {
      isTranslationCall = true;
    }
    if (isTranslationCall && node.arguments.length > 0) {
      const key = extractLiteralKey(node.arguments[0]);
      if (key) {
        const defaults = node.arguments.length > 1 ? extractDefaultStrings(node.arguments[1]) : [];
        addUsage(usages, key, defaults, filePath);
      }
    }
  }
  ts.forEachChild(node, (child) => walkAst(child, filePath, usages));
}

async function listSourceFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listSourceFiles(full)));
      continue;
    }
    if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      out.push(full);
    }
  }
  return out;
}

function pickDefault(key, defaultsMap) {
  if (KNOWN_DEFAULTS[key]) return KNOWN_DEFAULTS[key];
  if (!defaultsMap || defaultsMap.size === 0) {
    const tail = key.split('.').pop() ?? key;
    const withSpaces = tail
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim();
    return withSpaces ? withSpaces[0].toUpperCase() + withSpaces.slice(1) : key;
  }
  const ranked = [...defaultsMap.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0].length - a[0].length;
  });
  return ranked[0][0];
}

function needsAutoTranslation(currentValue, enValue) {
  if (currentValue === undefined) return true;
  if (typeof currentValue !== 'string') return false;
  if (typeof enValue !== 'string') return false;
  return currentValue.trim() === enValue.trim();
}

function protectPlaceholders(text) {
  const tokens = [];
  let output = text;
  const patterns = [/{{\s*[\w.-]+\s*}}/g, /%[sd]/g];
  for (const pattern of patterns) {
    output = output.replace(pattern, (match) => {
      const token = `__XPH_${tokens.length}__`;
      tokens.push({ token, value: match });
      return token;
    });
  }
  return { output, tokens };
}

function restorePlaceholders(text, tokens) {
  let output = text;
  for (const { token, value } of tokens) {
    output = output.split(token).join(value);
  }
  return output;
}

async function translateText(rawText, targetLang) {
  const text = rawText.trim();
  if (!text) return rawText;
  if (!/[A-Za-z]/.test(text)) return rawText;

  const { output, tokens } = protectPlaceholders(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(output)}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const translated = Array.isArray(data?.[0])
        ? data[0].map((part) => (Array.isArray(part) ? part[0] : '')).join('')
        : rawText;
      return restorePlaceholders(translated, tokens);
    } catch {
      await sleep(200 * (attempt + 1));
    }
  }
  return rawText;
}

async function translateMany(texts, targetLang, concurrency = 8) {
  const unique = [...new Set(texts.filter((text) => text && /[A-Za-z]/.test(text)))];
  const output = new Map();
  unique.forEach((text) => output.set(text, text));

  let index = 0;
  async function worker() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= unique.length) return;
      const text = unique[current];
      const translated = await translateText(text, targetLang);
      output.set(text, translated);
      if ((current + 1) % 50 === 0 || current + 1 === unique.length) {
        console.log(`[${targetLang}] translated ${current + 1}/${unique.length}`);
      }
    }
  }

  const workers = [];
  for (let i = 0; i < Math.max(1, concurrency); i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return output;
}

function toTsObjectLiteral(value, indent = 0) {
  const pad = '  '.repeat(indent);
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const lines = value.map((item) => `${'  '.repeat(indent + 1)}${toTsObjectLiteral(item, indent + 1)}`);
    return `[\n${lines.join(',\n')}\n${pad}]`;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([k, v]) => {
      const key = /^[$A-Z_][0-9A-Z_$]*$/i.test(k) ? k : JSON.stringify(k);
      return `${'  '.repeat(indent + 1)}${key}: ${toTsObjectLiteral(v, indent + 1)}`;
    });
    return `{\n${lines.join(',\n')}\n${pad}}`;
  }
  return 'null';
}

async function main() {
  const langSource = await fs.readFile(langFile, 'utf8');
  const langAst = ts.createSourceFile(langFile, langSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const env = {};
  for (const statement of langAst.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      if (!['enTranslations', 'arTranslations', 'frTranslations'].includes(decl.name.text)) continue;
      const value = evalExpression(decl.initializer, env);
      if (isPlainObject(value)) {
        env[decl.name.text] = value;
      }
    }
  }

  const en = env.enTranslations ?? {};
  const ar = env.arTranslations ?? {};
  const fr = env.frTranslations ?? {};

  const files = await listSourceFiles(srcRoot);
  const usages = new Map();
  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    const source = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    walkAst(source, filePath, usages);
  }

  const keys = [...usages.keys()].sort();
  const enPatch = {};
  const arPatch = {};
  const frPatch = {};
  const conflicts = [];

  const resolvedEnValue = new Map();

  for (const key of keys) {
    const usage = usages.get(key);
    const existingEn = getPath(en, key);

    if (existingEn !== undefined && typeof existingEn !== 'string') {
      conflicts.push({ key, type: 'en_non_string', existingType: typeof existingEn });
    }

    let enValue;
    if (typeof existingEn === 'string') {
      enValue = existingEn;
    } else if (existingEn === undefined) {
      enValue = pickDefault(key, usage.defaults);
      setPath(enPatch, key, enValue);
    } else {
      enValue = pickDefault(key, usage.defaults);
    }
    resolvedEnValue.set(key, enValue);
  }

  const arTextsNeeded = [];
  const frTextsNeeded = [];

  for (const key of keys) {
    const enValue = resolvedEnValue.get(key);
    if (typeof enValue !== 'string') continue;

    const currentAr = getPath(ar, key);
    const currentFr = getPath(fr, key);

    if (currentAr !== undefined && typeof currentAr !== 'string') {
      conflicts.push({ key, type: 'ar_non_string', existingType: typeof currentAr });
    }
    if (currentFr !== undefined && typeof currentFr !== 'string') {
      conflicts.push({ key, type: 'fr_non_string', existingType: typeof currentFr });
    }

    if (needsAutoTranslation(currentAr, enValue)) {
      arTextsNeeded.push(enValue);
    }
    if (needsAutoTranslation(currentFr, enValue)) {
      frTextsNeeded.push(enValue);
    }
  }

  const [arTranslationsByText, frTranslationsByText] = await Promise.all([
    translateMany(arTextsNeeded, 'ar'),
    translateMany(frTextsNeeded, 'fr'),
  ]);

  for (const key of keys) {
    const enValue = resolvedEnValue.get(key);
    if (typeof enValue !== 'string') continue;

    const currentAr = getPath(ar, key);
    const currentFr = getPath(fr, key);

    if (needsAutoTranslation(currentAr, enValue)) {
      setPath(arPatch, key, arTranslationsByText.get(enValue) ?? enValue);
    }
    if (needsAutoTranslation(currentFr, enValue)) {
      setPath(frPatch, key, frTranslationsByText.get(enValue) ?? enValue);
    }
  }

  for (const [key, value] of Object.entries(MANUAL_TRANSLATION_OVERRIDES.ar)) {
    setPath(arPatch, key, value);
  }
  for (const [key, value] of Object.entries(MANUAL_TRANSLATION_OVERRIDES.fr)) {
    setPath(frPatch, key, value);
  }

  const enMerged = deepMerge(en, enPatch);
  const arMerged = deepMerge(ar, arPatch);
  const frMerged = deepMerge(fr, frPatch);

  const flattenEn = flattenObject(enMerged);
  const flattenAr = flattenObject(arMerged);
  const flattenFr = flattenObject(frMerged);

  const missingEn = [];
  const missingAr = [];
  const missingFr = [];
  const arSameAsEn = [];
  const frSameAsEn = [];

  for (const key of keys) {
    const enValue = flattenEn.get(key);
    const arValue = flattenAr.get(key);
    const frValue = flattenFr.get(key);

    if (enValue === undefined) missingEn.push(key);
    if (arValue === undefined) missingAr.push(key);
    if (frValue === undefined) missingFr.push(key);

    if (typeof enValue === 'string' && typeof arValue === 'string' && enValue === arValue) {
      arSameAsEn.push(key);
    }
    if (typeof enValue === 'string' && typeof frValue === 'string' && enValue === frValue) {
      frSameAsEn.push(key);
    }
  }

  const overridesSource = `// Auto-generated by scripts/generate-i18n-overrides.mjs\n` +
    `// Do not edit by hand; re-run the generator instead.\n\n` +
    `export const translationOverrides = ${toTsObjectLiteral({ en: enPatch, ar: arPatch, fr: frPatch }, 0)} as const;\n`;

  await fs.writeFile(outputFile, overridesSource, 'utf8');

  const report = {
    totals: {
      usedKeys: keys.length,
      enPatchKeys: flattenObject(enPatch).size,
      arPatchKeys: flattenObject(arPatch).size,
      frPatchKeys: flattenObject(frPatch).size,
      missingEn: missingEn.length,
      missingAr: missingAr.length,
      missingFr: missingFr.length,
      arSameAsEn: arSameAsEn.length,
      frSameAsEn: frSameAsEn.length,
      conflicts: conflicts.length,
    },
    missingEn,
    missingAr,
    missingFr,
    arSameAsEn,
    frSameAsEn,
    conflicts,
  };

  await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf8');

  console.log('Generated:', outputFile);
  console.log('Report:', reportFile);
  console.log(JSON.stringify(report.totals, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
