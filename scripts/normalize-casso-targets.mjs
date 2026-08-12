import fs from 'node:fs';

const files = [
  'telehealth-backend/src/appointments/appointments.service.ts',
  'telehealth-frontend/src/Home.tsx',
];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const normalized = source.replace(/\r\n/g, '\n');
  fs.writeFileSync(file, normalized, 'utf8');
  console.log(`OK: normalized ${file}`);
}
