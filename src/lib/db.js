// Banco de dados em arquivos JSON (mesma filosofia do products.json do projeto P).
// Cada "tabela" é um arquivo em /data. Escrita atômica (tmp + rename) para não corromper.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const arquivos = new Map();

function file(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function read(name, fallback) {
  if (arquivos.has(name)) return arquivos.get(name);
  let value = fallback;
  try {
    value = JSON.parse(fs.readFileSync(file(name), 'utf8'));
  } catch {
    value = fallback;
  }
  arquivos.set(name, value);
  return value;
}

export function write(name, data) {
  arquivos.set(name, data);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${file(name)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file(name));
  return data;
}

export function update(name, fallback, fn) {
  const data = read(name, fallback);
  const result = fn(data);
  write(name, data);
  return result;
}

export function id(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function agora() {
  return new Date().toISOString();
}
