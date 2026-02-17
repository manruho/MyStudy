import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const logDir = path.join(root, 'content', 'logs');

function listLogJsonFiles(baseDir) {
  const out = [];
  if (!fs.existsSync(baseDir)) return out;
  const monthDirs = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const dirent of monthDirs) {
    if (!dirent.isDirectory()) continue;
    const month = dirent.name;
    const monthPath = path.join(baseDir, month);
    const files = fs.readdirSync(monthPath, { withFileTypes: true });
    for (const entry of files) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      out.push({
        month,
        fileName: entry.name,
        fullPath: path.join(monthPath, entry.name),
        rel: path.join('content', 'logs', month, entry.name)
      });
    }
  }
  out.sort((a, b) => a.rel.localeCompare(b.rel));
  return out;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidDateString(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function validateStudyItem(item, file, idx, errors) {
  const prefix = `${file} study[${idx}]`;
  if (!isObject(item)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  const keys = new Set(['subject', 'focus', 'detail', 'tags']);
  for (const key of Object.keys(item)) {
    if (!keys.has(key)) errors.push(`${prefix} has unknown field: ${key}`);
  }
  for (const key of ['subject', 'focus', 'detail']) {
    if (typeof item[key] !== 'string' || item[key].trim() === '') {
      errors.push(`${prefix}.${key} must be a non-empty string`);
    }
  }
  if (item.tags !== undefined) {
    if (!Array.isArray(item.tags)) {
      errors.push(`${prefix}.tags must be an array`);
    } else {
      item.tags.forEach((tag, tagIdx) => {
        if (typeof tag !== 'string' || tag.trim() === '') {
          errors.push(`${prefix}.tags[${tagIdx}] must be a non-empty string`);
        }
      });
    }
  }
}

function validateToshinItem(item, file, idx, errors) {
  const prefix = `${file} toshin[${idx}]`;
  if (!isObject(item)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  const keys = new Set(['subject', 'course', 'koma', 'memo']);
  for (const key of Object.keys(item)) {
    if (!keys.has(key)) errors.push(`${prefix} has unknown field: ${key}`);
  }
  for (const key of ['subject', 'course']) {
    if (typeof item[key] !== 'string' || item[key].trim() === '') {
      errors.push(`${prefix}.${key} must be a non-empty string`);
    }
  }
  if (!Number.isInteger(item.koma) || item.koma < 1) {
    errors.push(`${prefix}.koma must be an integer >= 1`);
  }
  if (item.memo !== undefined && typeof item.memo !== 'string') {
    errors.push(`${prefix}.memo must be a string`);
  }
}

function validateRoot(data, file, errors) {
  if (!isObject(data)) {
    errors.push(`${file} root must be an object`);
    return;
  }

  const allowed = new Set(['date', 'plan', 'notes', 'toshinKoma', 'study', 'toshin']);
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) errors.push(`${file} has unknown field: ${key}`);
  }

  if (typeof data.date !== 'string' || !isValidDateString(data.date)) {
    errors.push(`${file}.date must be a valid YYYY-MM-DD string`);
  }

  if (data.plan !== undefined && typeof data.plan !== 'string') {
    errors.push(`${file}.plan must be a string`);
  }

  if (data.notes !== undefined && typeof data.notes !== 'string') {
    errors.push(`${file}.notes must be a string`);
  }

  if (data.toshinKoma !== undefined && (!Number.isInteger(data.toshinKoma) || data.toshinKoma < 0)) {
    errors.push(`${file}.toshinKoma must be an integer >= 0`);
  }

  if (data.study !== undefined) {
    if (!Array.isArray(data.study)) {
      errors.push(`${file}.study must be an array`);
    } else {
      data.study.forEach((item, idx) => validateStudyItem(item, file, idx, errors));
    }
  }

  if (data.toshin !== undefined) {
    if (!Array.isArray(data.toshin)) {
      errors.push(`${file}.toshin must be an array`);
    } else {
      data.toshin.forEach((item, idx) => validateToshinItem(item, file, idx, errors));
    }
  }
}

function main() {
  if (!fs.existsSync(logDir)) {
    console.error('Missing directory: content/logs');
    process.exit(1);
  }

  const files = listLogJsonFiles(logDir);

  const errors = [];
  const seenDates = new Map();

  for (const file of files) {
    const { month, fileName, fullPath, rel } = file;
    const stem = path.basename(fileName, '.json');

    if (!/^\d{6}$/.test(month)) {
      errors.push(`${rel} parent folder must be YYYYMM`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(stem)) {
      errors.push(`${rel} filename must be YYYY-MM-DD.json`);
    }

    let data;
    try {
      data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (error) {
      errors.push(`${rel} is not valid JSON: ${error.message}`);
      continue;
    }

    validateRoot(data, rel, errors);

    if (typeof data.date === 'string') {
      if (data.date !== stem) {
        errors.push(`${rel} date mismatch: filename=${stem}, date=${data.date}`);
      }
      if (/^\d{6}$/.test(month)) {
        const expectedMonth = data.date.slice(0, 7).replace('-', '');
        if (month !== expectedMonth) {
          errors.push(`${rel} month folder mismatch: folder=${month}, date=${data.date}`);
        }
      }
      if (seenDates.has(data.date)) {
        errors.push(
          `Duplicate date ${data.date}: ${seenDates.get(data.date)} and ${rel}`
        );
      } else {
        seenDates.set(data.date, rel);
      }
    }
  }

  if (errors.length > 0) {
    console.error('Validation failed:\n');
    for (const err of errors) console.error(`- ${err}`);
    process.exit(1);
  }

  console.log(`Validation passed: ${files.length} log file(s)`);
}

main();
