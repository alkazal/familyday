const fs = require('fs');
const file = 'frontend/src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

const fixes = [
  ['â€"', '–'],
  ['ðŸ""', '🔔'],
  ['â˜€ Light', '☀ Light'],
  ['â˜¾ Dark', '☾ Dark'],
  ['ðŸ'¨â€ðŸ'©â€ðŸ'§', '👨‍👩‍👧'],
  ['ðŸ½ï¸', '🍽️'],
  ['ðŸ ', '🏠'],
  ['ðŸ…', '🏅'],
  ['ðŸ'¥', '👥'],
  ['âœ…', '✅'],
  ['ðŸ›ï¸', '🛏️'],
  ['ðŸª'', '🪑'],
  ['ðŸ†', '🏆'],
  ['â€º', '›'],
  ['ï¼‹', '+'],
  [' Â· ', ' · '],
  ['Ã—', '×'],
  ['âœ" Hadir', '✓ Hadir'],
  ['âœ— Tidak Hadir', '✗ Tidak Hadir'],
  ['â—‹ Belum Daftar', '○ Belum Daftar'],
];

for (const [from, to] of fixes) {
  const count = content.split(from).length - 1;
  if (count > 0) console.log(`  ${from} → ${to}  (${count}x)`);
  content = content.split(from).join(to);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Done!');
