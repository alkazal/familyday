const fs = require("fs");
const f = "c:/dev/scs/family-day-2026-admin/frontend/src/App.jsx";
let txt = fs.readFileSync(f, "utf8");

const correct = [
  "const menuItems = [",
  '  { key: "dashboard", label: "Dashboard", icon: "\u{1F3E0}" },',
  '  { key: "participants", label: "Peserta", icon: "\u{1F465}" },',
  '  { key: "attendance", label: "Kehadiran", icon: "\u2611\uFE0F" },',
  '  { key: "rooms", label: "Jenis Bilik", icon: "\u{1F6CF}\uFE0F" },',
  '  { key: "seating", label: "No. Meja", icon: "\u{1F37D}\uFE0F" },',
  '  { key: "telematch", label: "Telematch", icon: "\u{1F3C5}" },',
  '  { key: "program", label: "Aturcara", icon: "\u{1F4C5}" },',
  '  { key: "notifications", label: "Notifikasi", icon: "\u{1F514}" },',
  '  { key: "report", label: "Laporan", icon: "\u{1F4CA}" },',
  '  { key: "settings", label: "Tetapan", icon: "\u2699\uFE0F" },',
  "];",
].join("\n");

const re = /const menuItems = \[[\s\S]*?\];/;
const out = txt.replace(re, correct);
if (out !== txt) {
  fs.writeFileSync(f, out, "utf8");
  console.log("OK");
} else {
  console.log("NOMATCH");
}
