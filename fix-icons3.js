const fs = require("fs");
const file = "frontend/src/App.jsx";
let content = fs.readFileSync(file, "utf8");
let total = 0;

function fix(from, to) {
  const n = content.split(from).length - 1;
  if (n > 0) { content = content.split(from).join(to); total += n; console.log(n + "x  " + to); }
}

fix("\u00E2\u20AC\u201C", "\u2013");        // â€" → –  (en dash)  NOTE: last char is U+201C left double quote
fix("\u00F0\u009F\u0094\u0094", "\uD83D\uDD14"); // 🔔 bell
fix("\u00E2\u2122\u20AC Light", "\u2600 Light"); // ☀ Light
fix("\u00E2\u2122\u00BE Dark", "\u263E Dark");    // ☾ Dark
fix("\u00F0\u009F\u2019\u00A8\u00E2\u20AC\u0153\u00F0\u009F\u2019\u00A9\u00E2\u20AC\u0153\u00F0\u009F\u2019\u00A7", "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67"); // 👨‍👩‍👧
fix("\u00F0\u009F\u00BD\u00EF\u00B8\u008F", "\uD83C\uDF7D\uFE0F"); // 🍽️
fix("\u00F0\u009F\u00A0", "\uD83C\uDFE0");   // 🏠 house  
fix("\u00F0\u009F\u2026\u2026", "\uD83C\uDFC5"); // 🏅 medal
fix("\u00F0\u009F\u2019\u00A5", "\uD83D\uDC65"); // 👥 busts
fix("\u00E2\u009C\u2026", "\u2705");         // ✅
fix("\u00F0\u009F\u009B\u00EF\u00B8\u008F", "\uD83D\uDECF\uFE0F"); // 🛏️
fix("\u00F0\u009F\u00AA\u2018", "\uD83E\uDEA1"); // 🪑 chair (contains U+2018)
fix("\u00F0\u009F\u2020\u00AF", "\uD83C\uDFC6"); // 🏆 trophy
fix("\u00E2\u20AC\u00BA", "\u203A");         // › single right angle quote
fix("\u00EF\u00BC\u008B", "\u002B");         // ＋ → plain +
fix(" \u00C2\u00B7 ", " \u00B7 ");           // Â· → ·
fix("\u00C3\u2014", "\u00D7");               // Ã— → ×
fix("\u00E2\u009C\u201C Hadir", "\u2713 Hadir");   // ✓ Hadir
fix("\u00E2\u009C\u2014 Tidak Hadir", "\u2717 Tidak Hadir"); // ✗ Tidak Hadir
fix("\u00E2\u25CB\u008B Belum Daftar", "\u25CB Belum Daftar"); // ○ Belum Daftar

fs.writeFileSync(file, content, "utf8");
console.log("\nTotal replacements:", total);
