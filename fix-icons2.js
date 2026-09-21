const fs = require('fs');
const file = 'frontend/src/App.jsx';

// Read file as buffer
const buf = fs.readFileSync(file);
let content = buf.toString('utf8');

// Each mojibake string arose from UTF-8 emoji bytes being misread as
// Windows-1252 and re-saved as UTF-8. Fix by explicit byte-level mapping.
// We specify the broken sequence as a hex byte string and the correct replacement.

function hexToStr(hex) {
  return Buffer.from(hex, 'hex').toString('utf8');
}

const fixes = [
  // â€" (en dash –)  U+2013 → UTF-8: E2 80 93 → Latin1 â€" → UTF-8: C3 A2 E2 82 AC E2 80 9C ... 
  // Actually let's just match the literal mojibake string directly using Buffer
];

// Build replacement map: mojibake UTF-8 bytes → correct UTF-8 bytes
const replacements = [
  // Format: [mojibake hex bytes, correct emoji hex bytes]
  // â€" = U+00E2 U+20AC U+201C but that's wrong...
  // Let me use a different approach: encode the known mojibake as latin1 to get original bytes
  
  // Actually simplest: use the known correct emojis and encode target as "latin1 interpretation"
  // to reconstruct what the mojibake bytes look like
];

// Simpler: just do direct string.replace using Buffer for tricky chars
const emojiMap = [
  ['\u00E2\u20AC\u201D', '\u2013'],         // â€" → –
  ['\u00F0\u009F\u0094\u0094', '\uD83D\uDD14'], // bell 🔔
];

// Most reliable: use Buffer replace approach
// Read file bytes, find specific byte sequences, replace

let changed = 0;

function replaceBytes(content, fromHex, toHex) {
  const fromBuf = Buffer.from(fromHex, 'hex');
  const toBuf = Buffer.from(toHex, 'hex');
  const fromStr = fromBuf.toString('binary');
  const toStr = toBuf.toString('binary');
  const binaryContent = Buffer.from(content, 'utf8').toString('binary');
  if (binaryContent.includes(fromStr)) {
    changed++;
    const fixed = binaryContent.split(fromStr).join(toStr);
    return Buffer.from(fixed, 'binary').toString('utf8');
  }
  return content;
}

// Mojibake: each original emoji UTF-8 byte was treated as cp1252 and re-encoded
// Original F0 9F XX YY → as cp1252: F0='ð', 9F='Ÿ', XX, YY → re-UTF8 encoded
// Bytes in file: c3b0 c29f [XX encoded] [YY encoded]
// 
// Map of correct: emoji codepoint hex → broken UTF-8 bytes in file
const byteMap = [
  // – U+2013: UTF-8 E2 80 93 → cp1252: â(E2) €(80=E2 82 AC? no, 80 is control)
  // In cp1252: E2='â', 80='€'(actually cp1252 0x80=€), 93='"'(0x93=")
  // Re-UTF8: â=C3A2, €=E2 82 AC, "=E2 80 9C  → C3A2 E282AC E2809C
  ['c3a2e282ace2809c', 'e28093'],  // â€œ → – (en dash) WRONG - let me compute properly

  // Actually: E2 80 93 (UTF-8 for –)
  // In cp1252: E2=â, 80=€, 93=" (left double quotation mark 0x93 in cp1252 = U+201C)
  // Re-encoded UTF-8: C3A2 = â, E282AC = €, E2809C = "
  // So mojibake bytes: C3 A2 E2 82 AC E2 80 9C
  // BUT wait - 0x80 in cp1252 = € (U+20AC), UTF-8 = E2 82 AC
  // 0x93 in cp1252 = " (U+201C), UTF-8 = E2 80 9C
  // So total bytes: C3A2 E282AC E2809C = "â€œ"
  // Hmm but we see "â€"" in the file... let me reconsider
  
  // â€" has characters: â(U+00E2) + €? No...
  // â = U+00E2, UTF-8 = C3 A2
  // € = U+20AC, UTF-8 = E2 82 AC  
  // but the third char in â€" is a special char...
  
  // Actually: â€" is 3 chars: â(C3A2) + (unknown) + " or –
  // Looking at the byte pattern for – (U+2013): E2 80 93
  // E2 in cp1252 = â (U+00E2) → UTF-8 C3A2
  // 80 in cp1252 = € (U+20AC) → UTF-8 E282AC
  // 93 in cp1252 = " (U+201C, left double quotation) → UTF-8 E2809C
  // So file bytes: C3 A2 E2 82 AC E2 80 9C = â€œ NOT â€"
  
  // Hmm, so â€" has different bytes. Let me look at what â€" actually is:
  // â = C3A2 (U+00E2)  
  // € = E282AC? or just some other char?
  // " = some char
  // Checking: in cp1252 sequence yielding â€":
  //   E2 -> â, then what gives €? 
  //   € is 0x80 in cp1252. UTF-8 of € = E2 82 AC (3 bytes)
  //   But looking at it: â€" contains â + € + " where " might be – 
  //   So original UTF-8 bytes: E2 [80 is actually not the issue]
  //   
  // I'm overcomplicating this. Let me just use a literal approach.
];

// SIMPLEST APPROACH: literal byte replacement using latin1 trick
function fixMojibake(str, mojiStr, correctStr) {
  // mojiStr is what appears in the file as a JS string
  // correctStr is what it should be
  const count = str.split(mojiStr).length - 1;
  if (count > 0) {
    console.log(`  Found "${mojiStr}" (${count}x) → "${correctStr}"`);
    return str.split(mojiStr).join(correctStr);
  }
  return str;
}

// The key insight: since read_file shows us the mojibake strings, those ARE the 
// actual UTF-8 characters stored in the file. We can match them directly.
// The issue with the previous script was the CHAIR emoji mojibake contained a quote.
// Solution: construct that string from char codes to avoid JS parsing issue.

const chair_moji = '\u00F0\u009F\u00AA\u2018'; // ðŸª' using unicode escapes
const chair_emoji = '\uD83E\uDEA1'; // 🪑

content = fixMojibake(content, '\u00E2\u20AC\u201D', '\u2013'); // â€" → –  WRONG MAPPING
// Let me try different approach entirely.

// Read raw bytes and attempt a latin1->utf8 reinterpretation for the broken sections
// This is getting complex. Let me just output the byte values of what we have.

const testStr = content.substring(460 * 40, 461 * 40); // rough area
console.log('Sample around line 461:');
const idx = content.indexOf('PANEL PENGURUSAN');
if (idx > 0) {
  const chunk = content.substring(idx - 20, idx + 5);
  console.log('Raw chars:', [...chunk].map(c => c.codePointAt(0).toString(16)).join(' '));
  console.log('String:', chunk);
}

console.log('\nDone (diagnostic only)');
