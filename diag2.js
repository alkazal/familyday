const fs = require("fs");
const content = fs.readFileSync("frontend/src/App.jsx", "utf8");

function codepoints(str) {
  return [...str].map(c => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4,"0")).join(" ");
}

// Find the specific mojibake strings by searching for known surrounding text
const targets = [
  { label: "bell (topbar)", before: 'className="icon-alert"', after: '<em>12', grab: /\n\s+(.+?)\n/ },
];

// Search by context
const lines = content.split("\n");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.startsWith('icon:') || line.startsWith('icon=')) {
    const match = line.match(/icon[=:]\s*["'](.+?)["']/);
    if (match) {
      console.log("Line " + (i+1) + ": " + codepoints(match[1]) + "  => [" + match[1] + "]");
    }
  }
  if (line === 'PANEL PENGURUSAN' || line.includes('PANEL PENGURUSAN')) {
    const cp = codepoints(line.substring(line.indexOf('</span>') + 7, line.indexOf('PANEL') - 1));
    console.log("Line " + (i+1) + " dash: " + cp);
  }
  if (line.includes('ðŸ') || line.includes('â˜') || line.includes('âœ')) {
    if (!line.startsWith('//')) {
      console.log("Line " + (i+1) + ": " + codepoints(line) + "  => [" + line.substring(0,60) + "]");
    }
  }
}
