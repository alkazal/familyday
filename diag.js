const fs = require("fs");
const content = fs.readFileSync("frontend/src/App.jsx", "utf8");

// Find and print codepoints of a few key mojibake sequences
const markers = [
  { label: "â€– (en dash area)", search: "PANEL PENGURUSAN", offset: -5, len: 5 },
  { label: "bell icon", search: "icon-alert", offset: 30, len: 6 },
  { label: "☀/☾ toggle", search: "isDark ?", offset: 10, len: 8 },
  { label: "🏠 house icon", search: "Atur Bilik", offset: -10, len: 7 },
  { label: "🪑 chair icon", search: "orange-soft", offset: -15, len: 8 },
];

for (const m of markers) {
  const idx = content.indexOf(m.search);
  if (idx < 0) { console.log(m.label + ": NOT FOUND"); continue; }
  const chunk = content.substring(idx + m.offset, idx + m.offset + m.len);
  const cps = [...chunk].map(c => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4,"0")).join(" ");
  console.log(m.label + ":\n  chars: [" + chunk + "]\n  codes: " + cps + "\n");
}
