import fs from 'node:fs';

const questions = JSON.parse(fs.readFileSync(new URL('../seed/questions-v1.0.json', import.meta.url), 'utf8'));
const expected = {1:32,2:41,3:28,4:38,5:60,6:38,7:48,8:33,9:35,10:37};
const errors = [];
const counts = {};
const ids = new Set();
const prompts = new Map();

for (const q of questions) {
  counts[q.chapter] = (counts[q.chapter] || 0) + 1;
  if (ids.has(q.id)) errors.push(`ID duplicate: ${q.id}`);
  ids.add(q.id);

  const normalizedPrompt = String(q.prompt || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalizedPrompt) errors.push(`Prompt kosong: ${q.id}`);
  if (prompts.has(normalizedPrompt)) errors.push(`Prompt duplicate: ${q.id} dan ${prompts.get(normalizedPrompt)}`);
  prompts.set(normalizedPrompt, q.id);

  if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`Pilihan jawapan tidak sah: ${q.id}`);
  if (new Set(q.options).size !== q.options.length) errors.push(`Pilihan jawapan duplicate: ${q.id}`);
  if (!q.options.includes(q.answer)) errors.push(`Jawapan tiada dalam options: ${q.id}`);
  if (!['easy','medium','kbat'].includes(q.difficulty)) errors.push(`Aras tidak sah: ${q.id}`);
  if (!['mcq','tf'].includes(q.type)) errors.push(`Jenis tidak sah: ${q.id}`);
  if (!/^\d+\.\d+$/.test(String(q.subtopic))) errors.push(`Subtopik tidak sah: ${q.id}`);
  if (!String(q.explanation || '').trim()) errors.push(`Penerangan kosong: ${q.id}`);
}

for (const [chapter,total] of Object.entries(expected)) {
  if ((counts[chapter] || 0) !== total) errors.push(`Bab ${chapter}: dijangka ${total}, dapat ${counts[chapter] || 0}`);
}

if (questions.length !== 390) errors.push(`Jumlah bank: dijangka 390, dapat ${questions.length}`);

if (errors.length) {
  console.error('GeoBoost bank audit GAGAL');
  errors.forEach((e)=>console.error(`- ${e}`));
  process.exit(1);
}

console.log('GeoBoost bank audit OK');
console.log({ total: questions.length, counts });
console.log('Runtime question engine akan mengacak kedudukan pilihan jawapan bagi setiap sesi.');
