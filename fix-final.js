const fs = require("fs");
const file = "frontend/src/App.jsx";
let content = fs.readFileSync(file, "utf8");
let total = 0;

function fix(from, to, label) {
  const n = content.split(from).length - 1;
  if (n > 0) {
    content = content.split(from).join(to);
    total += n;
    console.log(n + "x  [" + label + "]  -> " + to);
  }
}

// --- Punctuation / symbols ---
fix("\u00E2\u20AC\u201D",   "\u2014",   "em dash —");          // â€" → —
fix("\u00E2\u20AC\u00BA",   "\u203A",   "› right angle quote"); // â€º → ›
fix("\u00C2\u00B7",         "\u00B7",   "· middle dot");        // Â· → ·
fix("\u00C3\u2014",         "\u00D7",   "× multiply");          // Ã— → ×
fix("\u00EF\u00BC\u2039",   "+",        "+ fullwidth plus");    // ï¼‹ → +

// --- Theme toggle icons ---
fix("\u00E2\u02DC\u20AC Light", "\u2600 Light", "☀ sun");      // â˜€ Light
fix("\u00E2\u02DC\u00BE Dark",  "\u263E Dark",  "☾ moon");     // â˜¾ Dark

// --- Emoji: 4-byte (U+1XXXX) ---
// 🔔 U+1F514  bytes F0 9F 94 94  moji: U+00F0 U+0178 U+201D U+201D
fix("\u00F0\u0178\u201D\u201D", "\uD83D\uDD14", "🔔 bell");

// 👨‍👩‍👧 family  F0 9F 91 A8 ZWJ F0 9F 91 A9 ZWJ F0 9F 91 A7
fix("\u00F0\u0178\u2018\u00A8\u00E2\u20AC\u008D\u00F0\u0178\u2018\u00A9\u00E2\u20AC\u008D\u00F0\u0178\u2018\u00A7",
    "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67", "👨‍👩‍👧 family");

// 🍽️ U+1F37D + U+FE0F
fix("\u00F0\u0178\u008D\u00BD\u00EF\u00B8\u008F", "\uD83C\uDF7D\uFE0F", "🍽️ fork plate");

// 🏠 U+1F3E0  bytes F0 9F 8F A0  moji: U+00F0 U+0178 U+008F U+00A0
fix("\u00F0\u0178\u008F\u00A0", "\uD83C\uDFE0", "🏠 house");

// 🏅 U+1F3C5  bytes F0 9F 8F 85  85→… (U+2026 in Win1252)
fix("\u00F0\u0178\u008F\u2026", "\uD83C\uDFC5", "🏅 medal");

// 👥 U+1F465  bytes F0 9F 91 A5  moji: U+00F0 U+0178 U+2018 U+00A5
fix("\u00F0\u0178\u2018\u00A5", "\uD83D\uDC65", "👥 busts");

// ✅ U+2705  bytes E2 9C 85  moji: U+00E2 U+0153 U+2026
fix("\u00E2\u0153\u2026", "\u2705", "✅ check box");

// 🛏️ U+1F6CF + U+FE0F  bytes F0 9F 9B 8F EF B8 8F
fix("\u00F0\u0178\u203A\u008F\u00EF\u00B8\u008F", "\uD83D\uDECF\uFE0F", "🛏️ bed");

// 🪑 U+1FA91  bytes F0 9F AA 91  91→' (U+2018 in Win1252)
fix("\u00F0\u0178\u00AA\u2018", "\uD83E\uDEA1", "🪑 chair");

// 🏆 U+1F3C6  bytes F0 9F 8F 86  86→† (U+2020 in Win1252)
fix("\u00F0\u0178\u008F\u2020", "\uD83C\uDFC6", "🏆 trophy");

// --- Attendance status text symbols ---
// ✓ U+2713  bytes E2 9C 93  93→" (U+201C)
fix("\u00E2\u0153\u201C", "\u2713", "✓ check");

// ✗ U+2717  bytes E2 9C 97  97→— (U+2014 in Win1252)
fix("\u00E2\u0153\u2014", "\u2717", "✗ cross");

// ○ U+25CB  bytes E2 97 8B  97→— (U+2014), 8B→‹ (U+2039)
fix("\u00E2\u2014\u2039", "\u25CB", "○ circle");

// --- TopBar title separator ---
// (already covered by em dash fix above)

fs.writeFileSync(file, content, "utf8");
console.log("\nTotal fixes:", total);
