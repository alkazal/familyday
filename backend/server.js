require("dotenv").config();

const express = require("express");
const cors = require("cors");
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const fs = require("fs");
const webpush = require("web-push");

// Notification history file (must be after path/fs require)

// Supabase-based notification history
async function saveNotificationHistory({ title, body, audience, sentAt, resultCount }) {
  if (!supabase) return;
  try {
    await supabase.from("notification_history").insert({
      title,
      body,
      audience,
      sent_at: sentAt,
      result_count: resultCount
    });
  } catch (err) {
    console.warn("[NOTIFY] Failed to save notification history to Supabase:", err.message);
  }
}

async function getNotificationHistory() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("notification_history")
      .select("id, title, body, audience, sent_at, result_count")
      .order("sent_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn("[NOTIFY] Failed to read notification history from Supabase:", err.message);
    return [];
  }
}

const app = express();
// Always-available health check route (before any file or env logic)
app.get('/api/ping', (req, res) => {
  try {
    res.json({ message: 'pong' });
  } catch (err) {
    console.error('Ping route error:', err);
    res.status(500).json({ error: 'Ping failed', details: String(err) });
  }
});

app.use(cors());
app.use(express.json());

// Telematch house images stored in backend/data/image
app.use(
  "/house-images",
  express.static(path.join(__dirname, "data", "image"))
);

const PORT = Number(process.env.PORT) || 5050;
const IS_VERCEL = !!process.env.VERCEL;
const DEBUG_API_TOKEN = clean(process.env.DEBUG_API_TOKEN);

const VAPID_PUBLIC_KEY = clean(process.env.VAPID_PUBLIC_KEY || "");
const VAPID_PRIVATE_KEY = clean(process.env.VAPID_PRIVATE_KEY || "");
const VAPID_SUBJECT = clean(process.env.VAPID_SUBJECT || "mailto:admin@example.com");

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log("[PUSH] VAPID configured.");
  } catch (err) {
    console.warn("[PUSH] Failed to set VAPID details:", err.message);
  }
} else {
  console.warn("[PUSH] VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
}

/*
  MAIN PARTICIPANT + ROOM FILE (updated 19.08.2026)
  Source supplied by Family Day committee:
  backend/data/2026 List Staff & Family For DoorGift & Welcoming Gift 19.08.2026.xlsx

  Participant records are read from:
  - SCS Room Detail
  - SES Room Detail
*/
const staffFamilyFile = path.join(
  __dirname,
  "data",
  "2026 List Staff & Family For DoorGift & Welcoming Gift 19.08.2026.xlsx"
);

/*
  Optional old room file. We no longer depend on this for peserta room.
  Room now comes from the 19.08.2026 Staff & Family workbook.
*/
const roomFile = path.join(
  __dirname,
  "data",
  "Room List SCS as at 07-10-22.xls"
);

const foodSeatingFile = path.join(
  __dirname,
  "data",
  "List for Food & Seating.xlsx"
);

const longServiceSCSFile = path.join(
  __dirname,
  "data",
  "List Long Service_2026 - SCS.xlsx"
);

const longServiceSESFile = path.join(
  __dirname,
  "data",
  "List Long Services_2026 - SES.xlsx"
);

/*
  AUTHORITATIVE LONG SERVICE AWARD 2026 FILE (updated 19.08.2026)
  Source: SENARAI PENERIMA DAN JUMLAH AWARD 2026.xlsx / Sheet1
*/
const longServiceAward2026File = path.join(
  __dirname,
  "data",
  "SENARAI PENERIMA DAN JUMLAH AWARD 2026.xlsx"
);

/*
  AUTHORITATIVE FAMILY DAY COMMITTEE FILE
  Sections supported: Main AJK, Sub AJK
*/
const committeeFile = path.join(
  __dirname,
  "data",
  "doc",
  "Main & Sub AJK.txt"
);

/* =========================
   EXCEL IN-MEMORY CACHE
========================= */

const _cache = {
  staffGroups: null,
  seating: null,
  longService: null,
  committee: null,
  attendanceOverrides: null,
  attendanceOverridesExpiresAt: 0,
  attendanceOverridesPromise: null,
};

const ATTENDANCE_CACHE_TTL_MS = Number(process.env.ATTENDANCE_CACHE_TTL_MS) || 15000;

function clearAttendanceCache() {
  _cache.attendanceOverrides = null;
  _cache.attendanceOverridesExpiresAt = 0;
  _cache.attendanceOverridesPromise = null;
  console.log("[CACHE] Attendance cache cleared.");
}

function clearExcelCache() {
  _cache.staffGroups = null;
  _cache.seating = null;
  _cache.longService = null;
  _cache.committee = null;
  clearAttendanceCache();
  console.log("[CACHE] Excel cache cleared.");
}

// Auto-invalidate cache when any Excel source file changes on disk
[
  staffFamilyFile,
  foodSeatingFile,
  longServiceSCSFile,
  longServiceSESFile,
  longServiceAward2026File,
  committeeFile,
].forEach((filePath) => {
  if (fs.existsSync(filePath)) {
    fs.watch(filePath, () => {
      console.log("[CACHE] File changed, clearing cache:", path.basename(filePath));
      clearExcelCache();
    });
  }
});

function clean(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log("[ENV] SUPABASE_URL:", SUPABASE_URL ? "LOADED" : "MISSING");
console.log(
  "[ENV] SUPABASE_SERVICE_ROLE_KEY:",
  SUPABASE_SERVICE_ROLE_KEY ? "LOADED" : "MISSING"
);

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

const TELEMATCH_CATEGORIES = ["Adult", "Kid", "Open"];
const TELEMATCH_TEAM_COLORS = ["Green", "Yellow", "Red", "Blue"];

const DEFAULT_TELEMATCH_GAMES = [
  {
    name: "Cari Barang Tersembunyi",
    description: "Opening Game. Kid 3 - 7 tahun. Pemain perlu mencari gula-gula / coklat di tempat yang disediakan.",
    category: "Kid",
    location: "Padang Telematch",
    start_time: null,
    end_time: null,
    max_team_members: 10,
  },
  {
    name: "Pindah Air Guna Span",
    description: "Kid 4 - 8 tahun. Peserta mencelup span ke dalam bekas berisi air, memindahkan dan memerah air ke dalam bekas kosong.",
    category: "Kid",
    location: "Padang Telematch",
    start_time: null,
    end_time: null,
    max_team_members: 10,
  },
  {
    name: "Mumia Wrap",
    description: "Kid 4 - 12 tahun. Balut seorang ahli kumpulan menggunakan tisu tandas sehingga menjadi mumia.",
    category: "Kid",
    location: "Padang Telematch",
    start_time: null,
    end_time: null,
    max_team_members: 10,
  },
  {
    name: "Berbaris Mengikut Arahan",
    description: "Kid 4 - 12 tahun. Peserta perlu mengikut arahan fizikal rawak daripada fasilitator.",
    category: "Kid",
    location: "Padang Telematch",
    start_time: null,
    end_time: null,
    max_team_members: 10,
  },
  {
    name: "Tarik Tali Mini",
    description: "Kid 7 - 12 tahun. Pertandingan tarik tali mini antara rumah.",
    category: "Kid",
    location: "Padang Telematch",
    start_time: null,
    end_time: null,
    max_team_members: 10,
  },
  {
    name: "Lari Kepit Belon & Bawa Bola Ping Pong Dalam Sudu",
    description: "Adult. Peserta mengepit belon dan membawa bola ping pong dalam sudu hingga ke garisan penamat.",
    category: "Adult",
    location: "Padang Telematch",
    start_time: null,
    end_time: null,
    max_team_members: 10,
  },
  {
    name: "4 x 50m Lari Berganti-Ganti",
    description: "Adult. Larian berganti-ganti dalam pasukan yang sama. Pasukan terpantas dikira pemenang.",
    category: "Adult",
    location: "Padang Telematch",
    start_time: null,
    end_time: null,
    max_team_members: 10,
  },
  {
    name: "Dadu Makan Tuan",
    description: "Adult. Peserta membaling dadu dan bergerak ke hadapan atau ke belakang mengikut nombor dadu.",
    category: "Adult",
    location: "Padang Telematch",
    start_time: null,
    end_time: null,
    max_team_members: 10,
  },
  {
    name: "Bola Pelikat",
    description: "Adult. Empat kumpulan bertanding. Setiap pasukan menghantar 4 lelaki dan 4 perempuan. Tempoh permainan 5 minit.",
    category: "Adult",
    location: "Padang Telematch",
    start_time: null,
    end_time: null,
    max_team_members: 10,
  },
];


function normalizeTelematchCategory(value) {
  const v = clean(value);
  if (!v) return "";

  if (/^adult$/i.test(v)) return "Adult";
  if (/^kid$/i.test(v)) return "Kid";
  if (/^open$/i.test(v)) return "Open";

  return "";
}

function normalizeTelematchTeamColor(value) {
  const v = clean(value);
  if (!v) return "";

  if (/^green$/i.test(v)) return "Green";
  if (/^yellow$/i.test(v)) return "Yellow";
  if (/^red$/i.test(v)) return "Red";
  if (/^blue$/i.test(v)) return "Blue";

  return "";
}

function isDebugAuthorized(req) {
  if (!DEBUG_API_TOKEN) return false;

  const fromHeader = clean(req.headers["x-debug-token"]);
  const fromQuery = clean(req.query?.token);

  return fromHeader === DEBUG_API_TOKEN || fromQuery === DEBUG_API_TOKEN;
}

function normalizeHeaderName(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStaffNo(value) {
  let v = clean(value);

  if (!v) return "";

  v = v.replace(/^SES\s*/i, "").replace(/^SCS\s*/i, "").trim();

  if (/^\d+$/.test(v)) {
    return v.padStart(3, "0");
  }

  return v;
}

function normalizePersonName(value) {
  return clean(value)
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[^A-Z0-9 @.'/-]/g, "")
    .trim();
}

function normalizePersonKey(value) {
  return normalizePersonName(value).replace(/[^A-Z0-9]/g, "");
}

function safeReadWorkbook(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    console.warn("[WARN] Excel file not found:", filePath);
    return null;
  }

  return XLSX.readFile(filePath, {
    cellDates: false,
    raw: false,
    cellStyles: true,
    cellNF: false,
    bookVBA: false,
    ...options,
  });
}


/* =========================
   CONFIRMED FAMILY DAY NON-PARTICIPANTS
   Authoritative source: staffFamilyFile sheets
   - SCS Tidak hadir
   - SES Tidak hadir

   IMPORTANT: This is NOT the live attendance/check-in status. These sheets
   contain staff confirmed as not joining Family Day.
========================= */
function getWorkbookSheetByNormalizedName(workbook, wantedName) {
  if (!workbook) return null;
  const wanted = clean(wantedName).toLowerCase().replace(/\s+/g, " ");
  const actualName = (workbook.SheetNames || []).find(
    (name) => clean(name).toLowerCase().replace(/\s+/g, " ") === wanted
  );
  return actualName ? { name: actualName, sheet: workbook.Sheets[actualName] } : null;
}

function findAbsenceHeaderIndex(row, candidates) {
  const normalizedCandidates = candidates.map((x) => normalizeHeaderName(x));
  return row.findIndex((cell) => {
    const h = normalizeHeaderName(cell);
    return normalizedCandidates.includes(h);
  });
}

// Confirmed non-participant sheets can contain family rows underneath a staff row.
// Only the primary participant types below should appear in the Dashboard list.
// IMPORTANT: Trainee and DK are intentionally treated as primary participants too.
function isConfirmedNonParticipantRelation(value) {
  const v = normalizeHeaderName(value);
  return [
    "staff",
    "staf",
    "trainee",
    "pelatih",
    "dk",
  ].includes(v);
}

// Explicit exclusions requested by the Family Day committee.
// These names may still exist in the authoritative "Tidak hadir" sheets,
// but they must not be counted or displayed in the Dashboard list.
const CONFIRMED_NON_PARTICIPANT_IGNORE_NAMES = new Set([
  normalizePersonKey("Abidah Binti Khalilur Rahman"),
  normalizePersonKey("Zaleha Binti Khalilur Rahman"),
  normalizePersonKey("Khadijah Binti Khalilur Rahman"),
  // Known spelling variants seen in earlier workbook revisions.
  normalizePersonKey("Zaleha Khalilur Rahman"),
  normalizePersonKey("Khatijah Binti Datuk Khalilur Rahman"),
  normalizePersonKey("Khadijah Binit Khalilur Rahman"),
]);

function shouldIgnoreConfirmedNonParticipant(name) {
  return CONFIRMED_NON_PARTICIPANT_IGNORE_NAMES.has(normalizePersonKey(name));
}

function loadConfirmedNonParticipants() {
  const workbook = safeReadWorkbook(staffFamilyFile);
  if (!workbook) return [];

  const sources = [
    { companyCode: "SCS", sheetName: "SCS Tidak hadir" },
    { companyCode: "SES", sheetName: "SES Tidak hadir" },
  ];

  const result = [];
  const seen = new Set();

  for (const source of sources) {
    const found = getWorkbookSheetByNormalizedName(workbook, source.sheetName);
    if (!found?.sheet) {
      console.warn(`[ABSENCE] Sheet not found: ${source.sheetName}`);
      continue;
    }

    const rows = XLSX.utils.sheet_to_json(found.sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });

    let headerRowIndex = -1;
    let staffNoIndex = -1;
    let nameIndex = -1;
    let relationIndex = -1;

    for (let i = 0; i < Math.min(rows.length, 40); i += 1) {
      const row = rows[i] || [];
      const candidateStaffNo = findAbsenceHeaderIndex(row, [
        "Staff No", "Staff No.", "Staff Number", "No Staff", "No. Staff"
      ]);
      const candidateName = findAbsenceHeaderIndex(row, ["Name", "Nama"]);
      const candidateRelation = findAbsenceHeaderIndex(row, [
        "Relation", "Relationship", "Hubungan", "Kategori", "Category"
      ]);
      if (candidateStaffNo >= 0 && candidateName >= 0) {
        headerRowIndex = i;
        staffNoIndex = candidateStaffNo;
        nameIndex = candidateName;
        relationIndex = candidateRelation;
        break;
      }
    }

    if (headerRowIndex < 0) {
      console.warn(`[ABSENCE] Header Staff No / Name not found in sheet: ${found.name}`);
      continue;
    }

    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] || [];
      const staffNo = normalizeStaffNo(getCell(row, staffNoIndex));
      const staffName = clean(getCell(row, nameIndex));
      const relation = relationIndex >= 0 ? clean(getCell(row, relationIndex)) : "";

      // Staff No is optional in the authoritative Tidak hadir sheets.
      // A valid name + eligible Relation is enough to include the person.
      if (!staffName) continue;
      if (normalizeHeaderName(staffName) === "name" || normalizeHeaderName(staffName) === "nama") continue;

      // Committee-maintained explicit exclusions.
      if (shouldIgnoreConfirmedNonParticipant(staffName)) {
        console.log(`[ABSENCE] Ignored by committee rule: ${staffName}`);
        continue;
      }

      // When a Relation column exists, include only Staff + Trainee + DK.
      // Family rows (Wife/Husband/Son/Daughter/Child/etc.) are deliberately excluded.
      // If an older sheet has no Relation column, keep the legacy behaviour instead
      // of silently dropping the whole sheet.
      if (relationIndex >= 0 && !isConfirmedNonParticipantRelation(relation)) continue;

      // Prefer Company + Staff No as the stable identity when Staff No exists.
      // If Staff No is blank (common for some Trainee/DK/legacy rows),
      // fall back to Company + normalized name so the person is still included
      // without creating duplicates.
      const personIdentity = staffNo || normalizePersonKey(staffName);
      const key = `${source.companyCode}:${personIdentity}`;
      if (seen.has(key)) continue;
      seen.add(key);

      result.push({
        id: `ABSENT-${source.companyCode}-${personIdentity}`,
        companyCode: source.companyCode,
        staffNo,
        staffName,
        relation: relation || "Staff",
        participantType: relation || "Staff",
        confirmedNotJoining: true,
        sourceSheet: found.name,
      });
    }
  }

  const countByCompany = result.reduce((acc, item) => {
    acc[item.companyCode] = (acc[item.companyCode] || 0) + 1;
    return acc;
  }, {});
  console.log(`[ABSENCE] Confirmed not joining loaded: SCS=${countByCompany.SCS || 0}, SES=${countByCompany.SES || 0}, TOTAL=${result.length}`);

  return result.sort((a, b) => {
    const companyCompare = a.companyCode.localeCompare(b.companyCode);
    if (companyCompare !== 0) return companyCompare;
    return a.staffName.localeCompare(b.staffName);
  });
}

function getCell(row, index) {
  if (index === undefined || index === null || index < 0) return "";
  return clean(row[index]);
}

function getSheetCell(worksheet, rowIndex, colIndex) {
  const address = XLSX.utils.encode_cell({
    r: rowIndex,
    c: colIndex,
  });

  return worksheet[address];
}

function getSheetCellText(worksheet, rowIndex, colIndex) {
  const cell = getSheetCell(worksheet, rowIndex, colIndex);
  if (!cell) return "";
  return clean(cell.w || cell.v);
}

function isProbablyHeaderOrEmpty(row) {
  const joined = row.map((x) => normalizeHeaderName(x)).join(" ");

  if (!joined) return true;
  if (joined.includes("staff no") && joined.includes("name")) return true;
  if (joined.includes("relation") && joined.includes("age")) return true;

  return false;
}

function buildFallbackPersonNo(companyCode, rowIndex, name) {
  const safeName = clean(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

  return `${companyCode}-${safeName || "PAX"}-${String(rowIndex + 1).padStart(
    3,
    "0"
  )}`;
}

function isPrimaryPersonRelation(value) {
  const v = normalizeHeaderName(value);

  return [
    "staff",
    "staf",
    "employee",
    "consultant",
    "contractor",
    "committee",
    "commitee",
    "vip",
    "guest",
    "peserta",
  ].includes(v);
}

function isFamilyRelation(value) {
  const v = normalizeHeaderName(value);

  return [
    "wife",
    "husband",
    "spouse",
    "son",
    "daughter",
    "child",
    "children",
    "father",
    "mother",
    "parent",
    "isteri",
    "suami",
    "anak",
    "bapa",
    "ayah",
    "ibu",
    "emak",
  ].includes(v);
}

function normalizeSex(value) {
  const v = normalizeHeaderName(value);

  if (v === "m" || v === "male" || v === "lelaki" || v === "l") return "M";
  if (v === "f" || v === "female" || v === "perempuan" || v === "p") return "F";

  return clean(value);
}

/* =========================
   TWO-ROW HEADER HELPERS
========================= */

function buildNewStaffColumnMap(headerRow1, headerRow2) {
  const map = {
    no: -1,
    staffNo: -1,
    name: -1,
    relation: -1,
    age: -1,
    sex: -1,
    room: -1,
    roomNumber: -1,
    status: -1,
    remarks: -1,
    adultCount: -1,
    kidsCount: -1,
    kidsMealCount: -1,
    othersCount: -1,
    tshirtColumns: [],
  };

  let currentGroup = "";

  for (let i = 0; i < Math.max(headerRow1.length, headerRow2.length); i++) {
    const h1 = normalizeHeaderName(headerRow1[i]);
    const h2 = normalizeHeaderName(headerRow2[i]);

    if (h1) currentGroup = h1;

    if (h1 === "no" || h1 === "bil" || h1 === "no.") map.no = i;
    if (h1.includes("staff no")) map.staffNo = i;
    if (h1 === "name" || h1.includes("nama")) map.name = i;
    if (h1.includes("relation") || h1.includes("hubungan")) map.relation = i;
    if (h1 === "age" || h1.includes("umur")) map.age = i;
    if (h1 === "sex" || h1.includes("gender") || h1.includes("jantina")) map.sex = i;
    if (h1.includes("room") || h1.includes("bilik")) map.room = i;
    if (h1.includes("status")) map.status = i;
    if (h1.includes("remark")) map.remarks = i;

    if (currentGroup.includes("t-shirt") && h2) {
      let groupLabel = "T-Shirt";

      if (currentGroup.includes("adult")) groupLabel = "Adult";
      if (currentGroup.includes("women")) groupLabel = "Women Long Sleeve";
      if (currentGroup.includes("child")) groupLabel = "Child";

      map.tshirtColumns.push({
        index: i,
        group: groupLabel,
        size: clean(headerRow2[i]),
      });
    }

    if (h2 === "adult") map.adultCount = i;
    if (h2 === "kids") map.kidsCount = i;
    if (h2.includes("kids with meal") || h2.includes("kids for meal")) {
      map.kidsMealCount = i;
    }
    if (h2 === "others") map.othersCount = i;
  }

  return map;
}

function findTshirtSelection(row, tshirtColumns) {
  const selected = [];

  tshirtColumns.forEach((col) => {
    const value = getCell(row, col.index);

    if (!value) return;

    const numberValue = Number(String(value).replace(/[^\d.]/g, ""));

    if (!Number.isNaN(numberValue) && numberValue > 0) {
      selected.push(`${col.group} ${col.size}`);
    }
  });

  return selected.join(", ");
}

function detectCategoryFromCounts(row, col) {
  const adult = Number(getCell(row, col.adultCount) || 0);
  const kids = Number(getCell(row, col.kidsCount) || 0);
  const kidsMeal = Number(getCell(row, col.kidsMealCount) || 0);
  const others = Number(getCell(row, col.othersCount) || 0);

  if (adult > 0) return "Adult";
  if (kids > 0) return "Kids";
  if (kidsMeal > 0) return "Kids with Meal";
  if (others > 0) return "Others";

  return "";
}

/* =========================
   LONG SERVICE / AWARD
========================= */

function normalizeAwardStaffNo(value) {
  return normalizeStaffNo(value);
}

function normalizeAwardNameKey(value) {
  // Canonicalize common Malay name abbreviations used inconsistently
  // between the participant workbook and the Long Service Award list.
  // Example: "Masuri Bte Mohamad" (award) = "Masuri Binti Mohamad" (participant).
  const normalized = normalizePersonName(value)
    .replace(/\bBTE\b/g, "BINTI")
    .replace(/\bBT\b/g, "BINTI")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.replace(/[^A-Z0-9]/g, "");
}

function parseAwardYearFromText(value) {
  const text = clean(value).toUpperCase();

  const match = text.match(/LONG SERVICES?\s+([0-9]+)\s+YEARS?/i);
  if (match) return `Long Service ${match[1]} Years`;

  return "";
}

function makeAwardRecord(
  companyCode,
  staffNo,
  name,
  designation,
  division,
  awardTitle,
  source
) {
  const cleanName = clean(name);

  if (!cleanName) return null;

  return {
    companyCode,
    staffNo: normalizeAwardStaffNo(staffNo),
    name: cleanName,
    nameKey: normalizeAwardNameKey(cleanName),
    designation: clean(designation),
    division: clean(division),
    awardTitle: clean(awardTitle) || "Long Service Award",
    isAwardRecipient: true,
    source,
  };
}

function parseAwardServiceSection(value) {
  const text = clean(value).toUpperCase();
  const match = text.match(/(15|20|25|30)\s*TAHUN/);
  if (!match) return null;

  const yearsOfService = Number(match[1]);
  const gramsMatch = text.match(/(\d+)\s*GRAMS?\s*916/);

  return {
    yearsOfService,
    awardTitle: `Long Service ${yearsOfService} Tahun`,
    gift: gramsMatch ? `${gramsMatch[1]} grams 916` : "",
  };
}

function loadLongServiceAward2026Rows() {
  const workbook = safeReadWorkbook(longServiceAward2026File);
  if (!workbook) return [];

  const worksheet = workbook.Sheets["Sheet1"] || workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) return [];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  });

  const output = [];
  let activeSection = null;

  for (const row of rows) {
    const first = getCell(row, 0);
    const name = getCell(row, 1);
    const sectionText = `${first} ${name}`.trim();
    const detectedSection = parseAwardServiceSection(sectionText);

    if (detectedSection) {
      activeSection = detectedSection;
      continue;
    }

    if (!activeSection || !name) continue;

    const normalizedName = normalizeHeaderName(name);
    if (
      normalizedName === "nama" ||
      normalizedName === "jumlah" ||
      String(name).trim().startsWith("=")
    ) {
      continue;
    }

    // Award recipient rows have a sequence number/formula in column A and
    // a real person's name in column B. Summary/formula rows are ignored.
    const firstText = String(first || "").trim();
    const looksLikeRecipient = /^\d+$/.test(firstText) || /^=1\+A\d+$/i.test(firstText);
    if (!looksLikeRecipient) continue;

    const cashRaw = getCell(row, 2);
    const cashAmount = Number(String(cashRaw || "").replace(/[^\d.]/g, "")) || 0;

    const record = makeAwardRecord(
      "",
      "",
      name,
      "",
      "",
      activeSection.awardTitle,
      "Long Service Award 2026"
    );

    if (!record) continue;

    output.push({
      ...record,
      yearsOfService: activeSection.yearsOfService,
      serviceLabel: `${activeSection.yearsOfService} Tahun`,
      gift: activeSection.gift,
      cashAmount,
    });
  }

  return output;
}

function loadLongServiceRows() {
  // The consolidated 2026 award workbook is now authoritative.
  // Legacy SCS/SES award workbooks are intentionally not merged here,
  // preventing duplicate or outdated recipients.
  return loadLongServiceAward2026Rows();
}

function buildLongServiceIndex() {
  const awards = loadLongServiceRows();
  const participantRows = loadStaffFamilyRows();

  // Resolve company/staff number from the current 19.08.2026 participant workbook
  // using the award recipient's name. The award workbook itself contains names only.
  const participantByName = new Map();
  participantRows.forEach((row) => {
    const nameKey = normalizeAwardNameKey(row.name || row.staffName);
    if (!nameKey) return;

    // Prefer staff rows when the same name appears more than once.
    if (!participantByName.has(nameKey) || row.isStaff) {
      participantByName.set(nameKey, {
        companyCode: row.companyCode || "",
        staffNo: normalizeAwardStaffNo(row.staffNo),
        designation: row.relation === "Staff" ? "Staff" : "",
      });
    }
  });

  awards.forEach((award) => {
    const matched = participantByName.get(award.nameKey);
    if (matched) {
      award.companyCode = matched.companyCode;
      award.staffNo = matched.staffNo;
      if (!award.designation) award.designation = matched.designation;
    }
  });

  const byStaff = new Map();
  const byName = new Map();

  awards.forEach((award) => {
    if (award.companyCode && award.staffNo) {
      byStaff.set(`${award.companyCode}-${award.staffNo}`, award);
    }

    if (award.nameKey) {
      if (award.companyCode) {
        byName.set(`${award.companyCode}-${award.nameKey}`, award);
      }
      byName.set(award.nameKey, award);
    }
  });

  return {
    awards,
    byStaff,
    byName,
  };
}

/* =========================
   STAFF + FAMILY + ROOM
========================= */

function loadStaffFamilyRows() {
  const workbook = safeReadWorkbook(staffFamilyFile);
  if (!workbook) return [];

  const allRows = [];
  const groupAssignments = loadWorkbookGroupAssignments(workbook);

  // The 19.08.2026 workbook separates SCS and SES into Room Detail sheets.
  // Keep the API contract unchanged: companyCode remains SCS / SES and
  // the Room Type column is exposed as peserta.room.
  const participantSheets = [
    { sheetName: "SCS Room Detail", companyCode: "SCS" },
    { sheetName: "SES Room Detail", companyCode: "SES" },
  ];

  participantSheets.forEach(({ sheetName, companyCode }) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      console.warn(`[WARN] Participant sheet not found: ${sheetName}`);
      return;
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
      raw: false,
    });

    if (!rows || rows.length < 3) return;

    const headerRow1 = rows[0];
    const headerRow2 = rows[1];

    // Row 1 contains grouped headings (STAFF & FAMILY DETAIL, ROOM DETAIL, ...),
    // while row 2 contains the actual field names. Build a map from row 2
    // and fall back to the existing two-row mapper for compatibility.
    const col = buildNewStaffColumnMap(headerRow1, headerRow2);

    headerRow2.forEach((value, index) => {
      const h = normalizeHeaderName(value);
      if (h === "no" || h === "bil" || h === "no.") col.no = index;
      if (h.includes("staff no")) col.staffNo = index;
      if (h === "name" || h.includes("nama")) col.name = index;
      if (h.includes("relation") || h.includes("hubungan")) col.relation = index;
      if (h === "age" || h.includes("umur")) col.age = index;
      if (h === "sex" || h.includes("gender") || h.includes("jantina")) col.sex = index;
      if (h === "room number" || h === "room no" || h === "no bilik" || h === "no. bilik") col.roomNumber = index;
      if (h === "room type" || h === "jenis bilik") col.room = index;
      if (h.includes("status")) col.status = index;
      if (h.includes("remark")) col.remarks = index;
    });

    if (col.name < 0) {
      console.warn(`[WARN] Name column not found in sheet: ${sheetName}`);
      return;
    }

    let currentStaffNo = "";
    let currentStaffName = "";
    let currentRoom = "";
    let currentRoomNumber = "";
    let currentStatus = "";
    // MCKK rows and their following Wife/Son/Daughter rows are dinner-table-only
    // guest blocks. Once an MCKK row is encountered, ignore that whole block
    // until the next real staff/primary participant row.
    let skippingMckkGuestBlock = false;

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];

      // A fully blank row is a hard household boundary in the authoritative
      // Room Detail sheets. Reset the current household so table-only guest
      // blocks (for example MCKK + Wife) are never attached to the previous
      // staff family by accident.
      const hasAnyContent = Array.isArray(row) && row.some((cell) => clean(cell));
      if (!hasAnyContent) {
        currentStaffNo = "";
        currentStaffName = "";
        currentRoom = "";
        currentRoomNumber = "";
        currentStatus = "";
        continue;
      }

      if (isProbablyHeaderOrEmpty(row)) continue;

      const noValue = getCell(row, col.no);
      const explicitStaffNo = normalizeStaffNo(getCell(row, col.staffNo));

      const name = getCell(row, col.name);
      const relation = getCell(row, col.relation);
      const age = getCell(row, col.age);
      const sex = normalizeSex(getCell(row, col.sex));
      const room = getCell(row, col.room);
      const roomNumber = getCell(row, col.roomNumber);
      const tshirtSize = findTshirtSelection(row, col.tshirtColumns);
      const category = detectCategoryFromCounts(row, col);
      const status = getCell(row, col.status);
      const remarks = getCell(row, col.remarks);

      if (!name) continue;

      const relationKey = normalizeHeaderName(relation);
      const relationIsMckk = relationKey === "mckk";
      const relationIsPrimaryPerson = isPrimaryPersonRelation(relation);
      const relationIsFamily = isFamilyRelation(relation);

      // MCKK is NOT part of any staff household/event. The MCKK person and
      // dependent rows that follow (Wife/Son/Daughter, etc.) are handled only
      // by the dedicated dinner-table guest loader. Prevent them from inheriting
      // the previous staff household when the Excel sheet has no blank row.
      if (relationIsMckk) {
        skippingMckkGuestBlock = true;
        currentStaffNo = "";
        currentStaffName = "";
        currentRoom = "";
        currentRoomNumber = "";
        currentStatus = "";
        continue;
      }

      const startsRealParticipant =
        !!explicitStaffNo ||
        relationIsPrimaryPerson ||
        (!!noValue && !relation);

      if (skippingMckkGuestBlock) {
        if (!startsRealParticipant) {
          // Wife/kids/etc. belonging to the MCKK guest remain table-only.
          continue;
        }
        skippingMckkGuestBlock = false;
      }

      let isStaffRow =
        !!explicitStaffNo ||
        (!!noValue && !relation) ||
        (!currentStaffNo && !relation) ||
        relationIsPrimaryPerson;

      if (relationIsFamily) {
        isStaffRow = false;
      }

      if (isStaffRow) {
        currentStaffNo =
          explicitStaffNo ||
          normalizeStaffNo(noValue) ||
          buildFallbackPersonNo(companyCode, i, name);

        currentStaffName = name;
        currentRoom = room || currentRoom;
        currentRoomNumber = roomNumber || currentRoomNumber;
        currentStatus = status || currentStatus;
      }

      if (!currentStaffNo) continue;

      const inheritedRoom = room || currentRoom || "Belum ditetapkan";
      const inheritedRoomNumber = roomNumber || currentRoomNumber || "Belum ditetapkan";
      const inheritedStatus = status || currentStatus || "Belum daftar";
      const assignment = groupAssignments.get(`${companyCode}-${currentStaffNo}`) || {};

      allRows.push({
        id: `${companyCode}-${currentStaffNo}-${i}`,
        companyCode,
        staffNo: currentStaffNo,
        loginCode: `${companyCode}-${currentStaffNo}`,
        staffName: currentStaffName || name,

        name,
        relation: isStaffRow ? relation || "Staff" : relation || "Family",
        isStaff: isStaffRow,

        age,
        sex,
        room: inheritedRoom,
        roomNumber: inheritedRoomNumber,
        tableNo: assignment.tableNo || "Belum ditetapkan",
        team: assignment.team || "",
        tshirtSize,
        category,
        status: inheritedStatus,
        remarks,
        sourceSheet: sheetName,
        sourceRow: i + 1,
      });
    }
  });

  return allRows;
}


function normalizeWorkbookTelematchTeam(value) {
  const v = clean(value).replace(/\s+/g, " ").trim();
  if (!v) return "";

  if (/blue\s+sharks?/i.test(v)) return "BLUE SHARKS";
  if (/red\s+lions?/i.test(v)) return "RED LIONS";
  if (/green\s+lynx/i.test(v)) return "GREEN LYNX";
  if (/lilac\s+wolves?/i.test(v)) return "LILAC WOLVES";

  return v.toUpperCase();
}

function buildWorkbookPrimaryPersonIndex(workbook) {
  const index = new Map();

  const sources = [
    { sheetName: "SCS Room Detail", companyCode: "SCS" },
    { sheetName: "SES Room Detail", companyCode: "SES" },
  ];

  sources.forEach(({ sheetName, companyCode }) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      blankrows: true,
      raw: false,
    });

    if (!rows || rows.length < 3) return;

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i] || [];
      const groupNo = normalizeStaffNo(row[0]);
      const explicitStaffNo = normalizeStaffNo(row[1]);
      const name = clean(row[2]);
      const relation = clean(row[3]);

      if (!name) continue;
      if (!groupNo && !explicitStaffNo) continue;
      if (relation && !isPrimaryPersonRelation(relation)) continue;

      const staffNo = explicitStaffNo || groupNo;
      const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (normalizedName) {
        index.set(`${companyCode}|${normalizedName}`, `${companyCode}-${staffNo}`);
      }
    }
  });

  return index;
}

function loadWorkbookGroupAssignments(workbook) {
  const assignments = new Map();
  const primaryPersonIndex = buildWorkbookPrimaryPersonIndex(workbook);

  const sources = [
    { sheetName: "SCS Dinner Table No", companyCode: "SCS", field: "tableNo" },
    { sheetName: "SES Dinner Table No", companyCode: "SES", field: "tableNo" },
    { sheetName: "SCS Telematch", companyCode: "SCS", field: "team" },
    { sheetName: "SES Telematch", companyCode: "SES", field: "team" },
  ];

  sources.forEach(({ sheetName, companyCode, field }) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      console.warn(`[WARN] Assignment sheet not found: ${sheetName}`);
      return;
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      blankrows: true,
      raw: false,
    });

    if (!rows || rows.length < 3) return;

    // Dinner Table and Telematch sheets are organised in visual group blocks.
    // A value in column M applies to the whole block, and a block may contain
    // more than one explicit Staff No (for example a spouse with their own staff
    // number, DV/Trainee, or another linked staff member).
    //
    // Build Dinner Table blocks first so every valid staff login in the same
    // family/group receives the same Table Number Dinner.
    if (field === "tableNo") {
      const blocks = [];
      let block = [];

      for (let i = 2; i < rows.length; i++) {
        const row = rows[i] || [];
        const hasContent = row.some((cell) => clean(cell));

        if (!hasContent) {
          if (block.length) {
            blocks.push(block);
            block = [];
          }
          continue;
        }

        block.push(row);
      }
      if (block.length) blocks.push(block);

      for (const groupRows of blocks) {
        const explicitTableValues = groupRows
          .map((row) => clean(row[12]).replace(/\.0$/, ""))
          .filter(Boolean);

        if (!explicitTableValues.length) continue;

        const rawTableValue = explicitTableValues[0];
        const tableNo = /^table\s+/i.test(rawTableValue)
          ? rawTableValue.replace(/^table\s*/i, "Table ")
          : `Table ${rawTableValue}`;

        const keys = new Set();

        for (const row of groupRows) {
          const staffNo = normalizeStaffNo(row[1]);
          const personName = clean(row[2]);
          const relation = clean(row[3]);
          const normalizedName = personName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();

          // Every explicit staff number inside the same Dinner block inherits
          // that block's table number.
          if (staffNo) {
            keys.add(`${companyCode}-${staffNo}`);
          }

          // Resolve primary rows without Staff No by name where possible.
          if (normalizedName && (!relation || isPrimaryPersonRelation(relation))) {
            const resolved = primaryPersonIndex.get(`${companyCode}|${normalizedName}`);
            if (resolved) keys.add(resolved);
          }
        }

        for (const key of keys) {
          const item = assignments.get(key) || { tableNo: "", team: "" };
          item.tableNo = tableNo;
          assignments.set(key, item);
        }
      }

      return;
    }

    // Telematch is organised in visual group blocks. A single group number in
    // column A can span more than one Staff row, and the house text in column M
    // applies to the whole block (for example SCS group 48 contains staff 390
    // and DV020, with GREEN LYNX written only on the first row). Build each block
    // first, then apply its explicit house text to every staff member in it.
    // Excel fill/background colours are intentionally ignored.
    if (field === "team") {
      const blocks = [];
      let block = [];

      for (let i = 2; i < rows.length; i++) {
        const row = rows[i] || [];
        const hasContent = row.some((cell) => clean(cell));

        // In the supplied Telematch sheets, one visual family/team block is a
        // contiguous run of rows and blocks are separated by a fully blank row.
        // Column A is not a reliable boundary: for SES121 its group number is
        // printed on the son's row, while for DV020 the group number is printed
        // on the row immediately above. Therefore blank separator rows are the
        // safe boundary signal.
        if (!hasContent) {
          if (block.length) {
            blocks.push(block);
            block = [];
          }
          continue;
        }

        block.push(row);
      }
      if (block.length) blocks.push(block);

      for (const groupRows of blocks) {
        const explicitTeams = groupRows
          .map((row) => normalizeWorkbookTelematchTeam(row[12]))
          .filter(Boolean);
        if (!explicitTeams.length) continue;

        const team = explicitTeams[0];
        const keys = new Set();

        for (const row of groupRows) {
          const staffNo = normalizeStaffNo(row[1]);
          const personName = clean(row[2]);
          const relation = clean(row[3]);
          const normalizedName = personName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();

          // Any explicit Staff No inside the same visual group is a participant
          // who should inherit that group's house.
          if (staffNo) keys.add(`${companyCode}-${staffNo}`);

          // Also resolve primary rows by name for workbook rows where Staff No is
          // absent, while avoiding spouse/child names becoming separate keys.
          if (normalizedName && (!relation || isPrimaryPersonRelation(relation))) {
            const resolved = primaryPersonIndex.get(`${companyCode}|${normalizedName}`);
            if (resolved) keys.add(resolved);
          }
        }

        for (const key of keys) {
          const item = assignments.get(key) || { tableNo: "", team: "" };
          item.team = team;
          assignments.set(key, item);
        }
      }

      return;
    }

    // Committee sheets are grouped by a primary participant, but the workbook
    // is not fully regular:
    // - some primary rows have Staff No but no group number in column A;
    // - some spouse/child rows contain the house assignment.
    // IMPORTANT: row/cell fill colours are presentation formatting only and are
    // never interpreted as a Telematch house assignment.
    // Keep the current participant key until a genuinely resolvable new primary
    // participant appears. Never discard a valid parent key just because a child
    // row happens to contain a number in column A.
    let currentKey = "";

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i] || [];
      const groupNo = clean(row[0]);
      const staffNo = normalizeStaffNo(row[1]);
      const personName = clean(row[2]);
      const relation = clean(row[3]);
      const normalizedName = personName.toLowerCase().replace(/[^a-z0-9]+/g, " " ).trim();

      // An explicit Staff No is the strongest boundary signal, even when column A
      // is blank (e.g. SES121 / DV020 in the supplied workbook).
      if (staffNo) {
        currentKey = `${companyCode}-${staffNo}`;
      } else if (groupNo && normalizedName) {
        // Only replace the current key when this row can be resolved as a primary
        // participant. This prevents a child row from accidentally terminating
        // the parent's group before its Telematch value is read.
        const resolved = primaryPersonIndex.get(`${companyCode}|${normalizedName}`) || "";
        if (resolved && (!relation || isPrimaryPersonRelation(relation) || resolved)) {
          currentKey = resolved;
        }
      }

      if (!currentKey) continue;

      // Use only the explicit value in "Warna Rumah Tele-Match" (column M).
      // Do not derive a house from Excel background/fill colour.
      const value = clean(row[12]);
      if (!value) continue;

      const item = assignments.get(currentKey) || { tableNo: "", team: "" };

      if (field === "tableNo") {
        const tableValue = clean(value).replace(/\.0$/, "");
        item.tableNo = /^table\s+/i.test(tableValue)
          ? tableValue.replace(/^table\s*/i, "Table ")
          : `Table ${tableValue}`;
      } else if (field === "team") {
        item.team = normalizeWorkbookTelematchTeam(value);
      }

      assignments.set(currentKey, item);
    }
  });

  return assignments;
}

function autoAssignTeam(staffNo) {
  const houses = [
    "Rumah Merah",
    "Rumah Hijau",
    "Rumah Kuning",
    "Rumah Biru",
  ];

  const n = parseInt(String(staffNo || "0").replace(/\D/g, ""), 10);

  if (Number.isNaN(n)) {
    return houses[0];
  }

  return houses[n % houses.length];
}

/* =========================
   SEATING
========================= */

function parseTableNo(value) {
  const text = clean(value);
  const match = text.match(/table\s*([0-9]+)/i);
  if (!match) return "";
  return match[1];
}

function getCellFillRgb(cell) {
  if (!cell || !cell.s) return "";

  const s = cell.s;

  return (
    clean(s.fgColor?.rgb) ||
    clean(s.fill?.fgColor?.rgb) ||
    clean(s.fill?.bgColor?.rgb) ||
    clean(s.patternFill?.fgColor?.rgb) ||
    ""
  ).toUpperCase();
}

function isBlueFill(cell) {
  const rgb = getCellFillRgb(cell);

  if (!rgb) return false;

  return (
    rgb.includes("00B0F0") ||
    rgb.includes("0070C0") ||
    rgb.includes("5B9BD5") ||
    rgb.includes("1F4E79") ||
    rgb.includes("4F81BD") ||
    rgb.includes("3C78D8") ||
    rgb.endsWith("0000FF")
  );
}

function loadSeatingRows() {
  const workbook = safeReadWorkbook(foodSeatingFile, {
    cellStyles: true,
  });

  if (!workbook) {
    return {
      tables: [],
      seats: [],
      summary: {
        totalTables: 0,
        totalSeats: 0,
        awardRecipients: 0,
      },
    };
  }

  const worksheet = workbook.Sheets["Seating"];

  if (!worksheet || !worksheet["!ref"]) {
    console.warn("[WARN] Seating sheet not found in:", foodSeatingFile);

    return {
      tables: [],
      seats: [],
      summary: {
        totalTables: 0,
        totalSeats: 0,
        awardRecipients: 0,
      },
    };
  }

  const range = XLSX.utils.decode_range(worksheet["!ref"]);

  const tableColumnPairs = [
    { tableCol: 1, nameCol: 2 },
    { tableCol: 4, nameCol: 5 },
    { tableCol: 7, nameCol: 8 },
    { tableCol: 10, nameCol: 11 },
    { tableCol: 13, nameCol: 14 },
    { tableCol: 16, nameCol: 17 },
  ];

  const tableMap = new Map();

  tableColumnPairs.forEach((pair) => {
    let currentTableNo = "";
    let currentTableName = "";

    for (let r = range.s.r; r <= range.e.r; r++) {
      const labelText = getSheetCellText(worksheet, r, pair.tableCol);
      const nameText = getSheetCellText(worksheet, r, pair.nameCol);

      const parsedTableNo = parseTableNo(labelText);

      if (parsedTableNo) {
        currentTableNo = parsedTableNo;
        currentTableName = `Table ${parsedTableNo}`;

        if (!tableMap.has(currentTableNo)) {
          tableMap.set(currentTableNo, {
            tableNo: currentTableNo,
            tableName: currentTableName,
            seats: [],
            count: 0,
            awardRecipients: 0,
          });
        }

        continue;
      }

      if (!currentTableNo) continue;

      const seatNo = clean(labelText);
      const personName = clean(nameText);

      if (!seatNo || !personName) continue;
      if (!/^\d+(\.0)?$/.test(String(seatNo))) continue;

      const normalizedSeatNo = String(parseInt(seatNo, 10));

      const nameCell = getSheetCell(worksheet, r, pair.nameCol);
      const seatCell = getSheetCell(worksheet, r, pair.tableCol);

      const isBlueSeat =
        isBlueFill(nameCell) ||
        isBlueFill(seatCell) ||
        normalizeHeaderName(personName).includes("penerima anugerah");

      const seat = {
        id: `T${currentTableNo}-${normalizedSeatNo}-${r + 1}`,
        tableNo: currentTableNo,
        tableName: currentTableName,
        seatNo: normalizedSeatNo,
        name: personName,

        // Raw Excel blue info only.
        // Final Penerima Anugerah is decided after matching with Long Service list.
        isBlueSeat,
        isAwardRecipient: false,
        category: "Peserta",

        sourceSheet: "Seating",
        sourceRow: r + 1,
      };

      tableMap.get(currentTableNo).seats.push(seat);
    }
  });

  const tables = Array.from(tableMap.values()).sort((a, b) => {
    return Number(a.tableNo) - Number(b.tableNo);
  });

  tables.forEach((table) => {
    table.count = table.seats.length;
    table.awardRecipients = table.seats.filter((x) => x.isAwardRecipient).length;
  });

  const seats = tables.flatMap((table) => table.seats);

  return {
    tables,
    seats,
    summary: {
      totalTables: tables.length,
      totalSeats: seats.length,
      awardRecipients: seats.filter((x) => x.isAwardRecipient).length,
    },
  };
}

function buildSeatingNameIndex(seating) {
  const map = new Map();

  (seating.seats || []).forEach((seat) => {
    const key = normalizePersonKey(seat.name);
    if (!key) return;

    if (!map.has(key)) {
      map.set(key, seat);
    }
  });

  return map;
}

function buildParticipantNameIndex(staffGroups) {
  const index = new Map();

  staffGroups.forEach((staff) => {
    const addName = (name, relation = "", awardInfo = null, isMainStaff = false) => {
      const key = normalizePersonKey(name);
      if (!key) return;

      if (!index.has(key)) {
        index.set(key, {
          companyCode: staff.companyCode,
          staffNo: staff.staffNo,
          staffName: staff.staffName,
          room: staff.room,
          roomNumber: staff.roomNumber,
          team: staff.team,
          relation,
          totalFamily: staff.totalFamily,

          // IMPORTANT FIX:
          // Only the exact person with awardInfo is Penerima Anugerah.
          // Wife/children/family do NOT inherit staff award.
          isAwardRecipient: !!awardInfo,
          awardInfo: awardInfo || null,
          isMainStaff,
        });
      }
    };

    // Main staff can be award recipient.
    addName(staff.staffName, "Staff", staff.awardInfo, true);

    // Family only award if their own name exists in award list.
    (staff.familyMembers || []).forEach((member) => {
      addName(member.name, member.relation, member.awardInfo, false);
    });
  });

  return index;
}


function loadMckkTableOnlyDinnerGuests() {
  const workbook = safeReadWorkbook(staffFamilyFile);
  if (!workbook) return [];

  const guests = [];
  const sheetPairs = [
    { companyCode: "SCS", roomSheet: "SCS Room Detail", dinnerSheet: "SCS Dinner Table No" },
    { companyCode: "SES", roomSheet: "SES Room Detail", dinnerSheet: "SES Dinner Table No" },
  ];

  const splitIntoBlocks = (rows, startIndex = 2) => {
    const blocks = [];
    let block = [];

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i] || [];
      const hasContent = row.some((cell) => clean(cell));
      if (!hasContent) {
        if (block.length) {
          blocks.push(block);
          block = [];
        }
        continue;
      }
      block.push(row);
    }

    if (block.length) blocks.push(block);
    return blocks;
  };

  const normalizedName = (value) => normalizePersonKey(clean(value));

  for (const { companyCode, roomSheet, dinnerSheet } of sheetPairs) {
    const roomWs = workbook.Sheets[roomSheet];
    const dinnerWs = workbook.Sheets[dinnerSheet];
    if (!roomWs || !dinnerWs) continue;

    const roomRows = XLSX.utils.sheet_to_json(roomWs, {
      header: 1,
      defval: "",
      blankrows: true,
      raw: false,
    });
    const dinnerRows = XLSX.utils.sheet_to_json(dinnerWs, {
      header: 1,
      defval: "",
      blankrows: true,
      raw: false,
    });

    const dinnerBlocks = splitIntoBlocks(dinnerRows);

    for (const roomBlock of splitIntoBlocks(roomRows)) {
      const mckkRows = roomBlock.filter(
        (row) => normalizeHeaderName(row[3]) === "mckk"
      );
      if (!mckkRows.length) continue;

      const roomPeople = roomBlock
        .map((row) => ({
          name: clean(row[2]),
          relation: clean(row[3]) || "MCKK",
          roomNumber: clean(row[13]),
        }))
        .filter((person) => person.name);

      const matchKeys = new Set(
        roomPeople
          .map((person) => normalizedName(person.name))
          .filter((key) => key && key !== "wife")
      );

      const matchingDinnerBlock = dinnerBlocks.find((block) =>
        block.some((row) => matchKeys.has(normalizedName(row[2])))
      );
      if (!matchingDinnerBlock) continue;

      const rawTableNo = matchingDinnerBlock
        .map((row) => clean(row[12]).replace(/\.0$/, ""))
        .find(Boolean);
      if (!rawTableNo) continue;

      const tableNo = /^table\s+/i.test(rawTableNo)
        ? rawTableNo.replace(/^table\s*/i, "")
        : rawTableNo;

      for (const person of roomPeople) {
        guests.push({
          companyCode,
          tableNo: String(tableNo).replace(/\.0$/, ""),
          name: person.name,
          relation: person.relation,
          roomNumber: person.roomNumber,
          tableOnly: true,
        });
      }
    }
  }

  return guests;
}

function buildSeatingWithParticipantMatch(staffGroups) {
  // Admin "No. Meja" now follows the authoritative Dinner Table assignments
  // from:
  //   - SCS Dinner Table No
  //   - SES Dinner Table No
  // column M: Table Number Dinner
  //
  // Do NOT use the legacy "Seating" worksheet here. That old sheet contains
  // a different 60-table seating plan and no longer represents the Family Day
  // Dinner Table allocation used by Staff View.

  const TOTAL_DINNER_TABLES = 50;
  const tableMap = new Map();

  for (let tableNo = 1; tableNo <= TOTAL_DINNER_TABLES; tableNo++) {
    const key = String(tableNo);
    tableMap.set(key, {
      tableNo: key,
      tableName: `Table ${key}`,
      seats: [],
      count: 0,
      awardRecipients: 0,
    });
  }

  // A linked staff/family structure can occasionally expose the same person
  // through more than one staff group. De-duplicate by table + normalized name.
  const seen = new Set();

  function parseDinnerTableNo(value) {
    const text = clean(value);
    if (!text || /belum/i.test(text)) return "";

    const match = text.match(/(\d+)/);
    if (!match) return "";

    const number = Number(match[1]);
    if (!Number.isFinite(number) || number < 1 || number > TOTAL_DINNER_TABLES) {
      return "";
    }

    return String(number);
  }

  function addPerson(tableNo, staff, person, relation, awardInfo, isMainStaff, options = {}) {
    const table = tableMap.get(tableNo);
    if (!table) return;

    const name = clean(person);
    if (!name) return;

    const normalizedName = normalizePersonKey(name);
    const duplicateKey = `${tableNo}|${normalizedName}`;

    if (seen.has(duplicateKey)) return;
    seen.add(duplicateKey);

    const seatNo = String(table.seats.length + 1);
    const isAwardRecipient = !!awardInfo;

    table.seats.push({
      id: `DINNER-T${tableNo}-${seatNo}-${normalizedName || seatNo}`,
      tableNo,
      tableName: table.tableName,
      seatNo,
      name,
      matched: true,
      companyCode: staff.companyCode || "",
      staffNo: options.tableOnly ? "" : (isMainStaff ? staff.staffNo || "" : ""),
      staffName: options.tableOnly ? "" : (staff.staffName || ""),
      relation: relation || (isMainStaff ? "Staff" : "Family"),
      room: options.tableOnly ? "" : (staff.room || ""),
      roomNumber: options.roomNumber || staff.roomNumber || "",
      team: options.tableOnly ? "" : (staff.team || ""),
      isAwardRecipient,
      awardInfo: awardInfo || null,
      category: options.tableOnly
        ? "Tetamu Meja"
        : (isAwardRecipient ? "Penerima Anugerah" : "Peserta"),
      tableOnly: !!options.tableOnly,
      sourceSheet: `${staff.companyCode || ""} Dinner Table No`,
    });
  }

  (staffGroups || []).forEach((staff) => {
    const tableNo = parseDinnerTableNo(staff.tableNo);
    if (!tableNo) return;

    addPerson(
      tableNo,
      staff,
      staff.staffName,
      "Staff",
      staff.awardInfo,
      true
    );

    (staff.familyMembers || []).forEach((member) => {
      addPerson(
        tableNo,
        staff,
        member.name,
        member.relation || "Family",
        member.awardInfo || null,
        false
      );
    });
  });

  // MCKK guest blocks are dinner-table-only. They must not become part of the
  // preceding staff household and must not inherit Telematch/Karaoke/event data.
  // Keep them visible only in Admin -> No. Meja.
  loadMckkTableOnlyDinnerGuests().forEach((guest) => {
    const tableNo = parseDinnerTableNo(guest.tableNo);
    if (!tableNo) return;

    addPerson(
      tableNo,
      { companyCode: guest.companyCode, staffNo: "", staffName: "", room: "", roomNumber: guest.roomNumber || "", team: "" },
      guest.name,
      guest.relation || "MCKK",
      null,
      false,
      { tableOnly: true, roomNumber: guest.roomNumber || "" }
    );
  });

  const tables = Array.from(tableMap.values()).sort(
    (a, b) => Number(a.tableNo) - Number(b.tableNo)
  );

  tables.forEach((table) => {
    table.count = table.seats.length;
    table.awardRecipients = table.seats.filter(
      (seat) => seat.isAwardRecipient
    ).length;
  });

  const seats = tables.flatMap((table) => table.seats);

  return {
    tables,
    seats,
    summary: {
      totalTables: TOTAL_DINNER_TABLES,
      totalSeats: seats.length,
      awardRecipients: seats.filter((seat) => seat.isAwardRecipient).length,
    },
  };
}

/* =========================
   MAIN / SUB AJK COMMITTEE
========================= */

const COMMITTEE_NAME_ALIASES = new Map([
  // Participant workbook spelling/name variants -> authoritative AJK list name.
  [normalizeAwardNameKey("Norasahkirin Binti Ithnin"), normalizeAwardNameKey("Norashakirin Binti Ithin")],
  [normalizeAwardNameKey("Siti Jusfina Binti Mohd Tajuddin"), normalizeAwardNameKey("Jusfina Binti Mohd Tajuddin")],
  [normalizeAwardNameKey("Wan Arif Amir Muhammad Bin Wahid"), normalizeAwardNameKey("Wan Arif Amir Bin Muhammad Wahid")],
  [normalizeAwardNameKey("Nurul Nadiyanaelya Binti Ilyas"), normalizeAwardNameKey("Nurul Nadiayanaelya Binti Ilyas")],
  [normalizeAwardNameKey("Muhammad Azamuddin Bin Mohd Azahari"), normalizeAwardNameKey("Muhammad Azamuddin Azahari")],
  [normalizeAwardNameKey("Nurhisham Bin Mohamed Nor"), normalizeAwardNameKey("Nurhisham Bin Mohd Nor")],
  [normalizeAwardNameKey("Muhammad Azim Bin Shadan"), normalizeAwardNameKey("Muhammad Azim Shadan")],
  [normalizeAwardNameKey("Wan Nurazniera Binti Wan Mohd Nor"), normalizeAwardNameKey("Wan Nurazniera Bin Wan Mohd Nor")],
  [normalizeAwardNameKey("Tasneem Zaki Binti Nasir Zihni"), normalizeAwardNameKey("Tasneem Binti Zaki Nasir Zahni")],
]);

function resolveCommitteeForName(
  name,
  committeeIndex,
  companyCode = "",
  staffNo = ""
) {
  const nameKey = normalizeAwardNameKey(name);

  // Prefer authoritative Company + Staff No from "Main & Sub AJK.txt".
  const staffKey =
    clean(companyCode) && clean(staffNo)
      ? `${clean(companyCode).toUpperCase()}-${normalizeAwardStaffNo(staffNo)}`
      : "";

  if (staffKey) {
    const staffMatch = committeeIndex.byStaff?.get(staffKey);
    if (staffMatch) {
      return { ...staffMatch, matchType: "staff_no", matchScore: 1 };
    }
  }

  if (!nameKey) return null;

  // Never auto-assign by fuzzy similarity because committee membership affects
  // badges and notification audiences.
  const exact = committeeIndex.byName.get(nameKey);
  if (exact) return { ...exact, matchType: "exact", matchScore: 1 };

  // Support spelling aliases in either direction.
  const directAliasKey = COMMITTEE_NAME_ALIASES.get(nameKey);
  if (directAliasKey) {
    const aliasMatch = committeeIndex.byName.get(directAliasKey);
    if (aliasMatch) {
      console.log(
        `[COMMITTEE] Alias matched "${name}" -> "${aliasMatch.name}"`
      );
      return { ...aliasMatch, matchType: "alias", matchScore: 1 };
    }
  }

  for (const [committeeNameKey, participantNameKey] of COMMITTEE_NAME_ALIASES) {
    if (participantNameKey !== nameKey) continue;
    const aliasMatch = committeeIndex.byName.get(committeeNameKey);
    if (aliasMatch) {
      console.log(
        `[COMMITTEE] Reverse alias matched "${name}" -> "${aliasMatch.name}"`
      );
      return { ...aliasMatch, matchType: "alias", matchScore: 1 };
    }
  }

  return null;
}

function loadCommitteeIndex() {
  if (_cache.committee) return _cache.committee;

  const byName = new Map();
  const byStaff = new Map();
  const members = [];

  try {
    if (!fs.existsSync(committeeFile)) {
      console.warn("[COMMITTEE] File not found:", committeeFile);
      _cache.committee = { byName, byStaff, members };
      return _cache.committee;
    }

    const lines = fs.readFileSync(committeeFile, "utf8").split(/\r?\n/);
    let activeRole = "";

    lines.forEach((rawLine) => {
      const line = clean(rawLine);
      if (!line || /^[-=]+$/.test(line)) return;

      const header = line.toUpperCase().replace(/\s+/g, " ");
      if (header === "MAIN AJK") {
        activeRole = "MAIN_AJK";
        return;
      }
      if (header === "SUB AJK") {
        activeRole = "SUB_AJK";
        return;
      }
      if (!activeRole) return;

      // Authoritative row format:
      //   SCS 301   | Mariah Tasbi Binti Abd Wahid
      //   SCS DV023 | Wan Nurazniera Binti Wan Mohd Nor
      const match = line.match(/^([A-Za-z]+)\s+([A-Za-z0-9-]+)\s*\|\s*(.+)$/);
      if (!match) {
        console.warn("[COMMITTEE] Ignoring invalid row:", line);
        return;
      }

      const companyCode = clean(match[1]).toUpperCase();
      const staffNo = normalizeAwardStaffNo(match[2]);
      const name = clean(match[3]);
      const nameKey = normalizeAwardNameKey(name);
      if (!nameKey || !companyCode || !staffNo) return;

      const info = {
        companyCode,
        staffNo,
        name,
        role: activeRole,
        label: activeRole === "MAIN_AJK" ? "Main AJK" : "Sub AJK",
        isCommittee: true,
      };

      byName.set(nameKey, info);
      byStaff.set(`${companyCode}-${staffNo}`, info);
      members.push(info);
    });

    const mainCount = members.filter((m) => m.role === "MAIN_AJK").length;
    const subCount = members.filter((m) => m.role === "SUB_AJK").length;

    console.log(
      `[COMMITTEE] Loaded ${members.length} committee member(s) ` +
        `(Main ${mainCount}, Sub ${subCount}) from ${path.basename(committeeFile)}.`
    );
  } catch (error) {
    console.warn("[COMMITTEE] Failed to read committee file:", error.message);
  }

  _cache.committee = { byName, byStaff, members };
  return _cache.committee;
}

/* =========================
   BUILD DATA
========================= */

function buildStaffGroups() {
  const rows = loadStaffFamilyRows();
  const longServiceIndex = buildLongServiceIndex();
  const committeeIndex = loadCommitteeIndex();

  const map = new Map();

  rows.forEach((row) => {
    const key = `${row.companyCode}-${row.staffNo}`;

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        companyCode: row.companyCode,
        staffNo: row.staffNo,
        staffName: row.staffName || row.name,
        age: row.isStaff ? Number(row.age || 0) : 0,
        sex: row.isStaff ? row.sex || "" : "",
        room: row.room || "Belum ditetapkan",
        roomNumber: row.roomNumber || "Belum ditetapkan",
        tableNo: row.tableNo || "Belum ditetapkan",
        team: row.team || "Belum ditetapkan",
        attendance: row.status || "Belum daftar",
        totalFamily: 0,
        familyMembers: [],
        isAwardRecipient: false,
        awardInfo: null,
        isCommittee: false,
        committeeRole: "",
        committeeLabel: "",
      });
    }

    const group = map.get(key);

    if (row.isStaff) {
      group.staffName = row.name || group.staffName;

      const staffAge = Number(row.age || 0);
      if (Number.isFinite(staffAge) && staffAge > 0) {
        group.age = staffAge;
      }

      if (row.sex) {
        group.sex = row.sex;
      }
    }

    if (row.room && row.room !== "Belum ditetapkan") {
      group.room = row.room;
    }

    if (row.roomNumber && row.roomNumber !== "Belum ditetapkan") {
      group.roomNumber = row.roomNumber;
    }

    if (row.tableNo && row.tableNo !== "Belum ditetapkan") {
      group.tableNo = row.tableNo;
    }

    if (row.team) {
      group.team = row.team;
    }

    if (row.status) {
      group.attendance = row.status;
    }

    const duplicateKey = `${String(row.name || "").toLowerCase()}|${String(
      row.relation || ""
    ).toLowerCase()}|${String(row.age || "")}|${String(row.sex || "")}`;

    const alreadyExists = group.familyMembers.some((member) => {
      const existingKey = `${String(member.name || "").toLowerCase()}|${String(
        member.relation || ""
      ).toLowerCase()}|${String(member.age || "")}|${String(member.sex || "")}`;

      return existingKey === duplicateKey;
    });

    if (!alreadyExists) {
      group.familyMembers.push({
        name: row.name,
        relation: row.relation || "Family",
        age: row.age,
        sex: row.sex,
        tshirtSize: row.tshirtSize,
        category: row.category,
        status: row.status || "Belum daftar",
        remarks: row.remarks,
        isStaff: row.isStaff,
        isAwardRecipient: false,
        awardInfo: null,
      });
    }

    group.totalFamily = group.familyMembers.length;
  });

  const staffGroups = Array.from(map.values());

  // Approved one-household exception: SCS-390 + DV020.
  // The authoritative Room Detail source currently contains Ernawati as the
  // household owner, while Mohd Holi is present in the event/Telematch source
  // with his own DV020 login. Keep both people visible in the SAME household
  // without creating a second family account.
  const specialHousehold = staffGroups.find(
    (staff) => String(staff.id || "").toUpperCase() === "SCS-390"
  );

  if (specialHousehold) {
    const husbandName = "Mohd Holi Bin Hanafiah";
    const husbandKey = normalizePersonKey(husbandName);
    const hasHusband = (specialHousehold.familyMembers || []).some(
      (member) => normalizePersonKey(member.name) === husbandKey
    );

    if (!hasHusband) {
      specialHousehold.familyMembers.push({
        name: husbandName,
        relation: "Husband",
        age: 52,
        sex: "M",
        tshirtSize: "",
        category: "Adult",
        status: specialHousehold.attendance || "Belum daftar",
        remarks: "Linked login DV-020",
        isStaff: false,
        linkedLoginGroup: "DV",
        linkedStaffNo: "020",
        isAwardRecipient: false,
        awardInfo: null,
      });
    }

    specialHousehold.totalFamily = specialHousehold.familyMembers.length;
  }

  staffGroups.forEach((staff) => {
    const staffKey = `${staff.companyCode}-${normalizeAwardStaffNo(
      staff.staffNo
    )}`;
    const nameKey = normalizeAwardNameKey(staff.staffName);

    const award =
      longServiceIndex.byStaff.get(staffKey) ||
      longServiceIndex.byName.get(`${staff.companyCode}-${nameKey}`) ||
      longServiceIndex.byName.get(nameKey);

    staff.isAwardRecipient = !!award;
    staff.awardInfo = award || null;

    const committee = resolveCommitteeForName(
      staff.staffName,
      committeeIndex,
      staff.companyCode,
      staff.staffNo
    );
    staff.isCommittee = !!committee;
    staff.committeeRole = committee?.role || "";
    staff.committeeLabel = committee?.label || "";
    staff.committeeMatchType = committee?.matchType || "";
    staff.committeeMatchScore = committee?.matchScore || 0;

    staff.familyMembers = (staff.familyMembers || []).map((member) => {
      const memberNameKey = normalizeAwardNameKey(member.name);

      const memberAward =
        longServiceIndex.byName.get(`${staff.companyCode}-${memberNameKey}`) ||
        longServiceIndex.byName.get(memberNameKey);

      // A committee member can be a spouse/family member rather than the staff owner.
      // Keep the AJK identity on that person, while notifications can still route
      // through the owning staff login/subscription.
      const memberCommittee = resolveCommitteeForName(member.name, committeeIndex);

      return {
        ...member,
        isAwardRecipient: !!memberAward,
        awardInfo: memberAward || null,
        isCommittee: !!memberCommittee,
        committeeRole: memberCommittee?.role || "",
        committeeLabel: memberCommittee?.label || "",
        committeeMatchType: memberCommittee?.matchType || "",
        committeeMatchScore: memberCommittee?.matchScore || 0,
      };
    });
  });

  const seatingRaw = loadSeatingRows();
  const seatingNameIndex = buildSeatingNameIndex(seatingRaw);

  staffGroups.forEach((staff) => {
    const staffKey = normalizePersonKey(staff.staffName);
    const staffSeat = seatingNameIndex.get(staffKey);

    // Dinner table assignment is authoritative from:
    // SCS Dinner Table No / SES Dinner Table No -> Table Number Dinner.
    // Do not override it from the legacy seating workbook.
    void staffSeat;
  });

  staffGroups.sort((a, b) => {
    if (a.companyCode !== b.companyCode) {
      return a.companyCode.localeCompare(b.companyCode);
    }

    const staffA = parseInt(String(a.staffNo || "0").replace(/\D/g, ""), 10);
    const staffB = parseInt(String(b.staffNo || "0").replace(/\D/g, ""), 10);

    if (Number.isNaN(staffA) || Number.isNaN(staffB)) {
      return String(a.staffNo || "").localeCompare(String(b.staffNo || ""));
    }

    return staffA - staffB;
  });

  return staffGroups;
}

async function getAttendanceSummaryFromSupabase() {
  const staffGroups = getStaffGroups();
  const seating = getCachedSeating();
  const longService = getCachedLongService();
  const attendanceOverrides = await getCachedAttendanceOverrides(staffGroups);

  const totalStaff = staffGroups.length;

  const totalParticipants = staffGroups.reduce((sum, x) => {
    return sum + Number(x.totalFamily || 0);
  }, 0);

  const attended = staffGroups.reduce((count, staff) => {
    const loginCode = makeStaffLoginCode(staff.companyCode, staff.staffNo);
    const override = attendanceOverrides.get(loginCode);
    return override?.attendance === "Hadir" ? count + 1 : count;
  }, 0);

  const roomBreakdown = buildRoomsData(staffGroups);
  const totalRoomUnits = roomBreakdown.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0
  );
  const totalRoomTypes = roomBreakdown.filter((item) => Number(item.count || 0) > 0).length;

  const teams = new Set(staffGroups.map((x) => x.team).filter(Boolean));

  return {
    totalStaff,
    totalParticipants,
    attendance: attended,
    attendancePercent:
      totalStaff === 0 ? 0 : Number(((attended / totalStaff) * 100).toFixed(1)),
    totalRooms: totalRoomUnits,
    totalRoomTypes,
    totalTables: seating.summary.totalTables,
    totalSeats: seating.summary.totalSeats,
    awardRecipients: longService.awards.length,
    awardServiceBreakdown: [15, 20, 25, 30].map((years) => ({
      years,
      count: longService.awards.filter((x) => x.yearsOfService === years).length,
    })),
    seatingAwardRecipients: seating.summary.awardRecipients,
    totalTeams: teams.size,
  };
}

/* =========================
   CACHED GETTERS
========================= */

function getStaffGroups() {
  if (!_cache.staffGroups) {
    console.log("[CACHE] Parsing staff Excel...");
    _cache.staffGroups = buildStaffGroups();
    console.log(`[CACHE] Cached ${_cache.staffGroups.length} staff groups.`);
  }
  return _cache.staffGroups;
}

function getCachedLongService() {
  if (!_cache.longService) {
    _cache.longService = buildLongServiceIndex();
  }
  return _cache.longService;
}

function getCachedSeating() {
  if (!_cache.seating) {
    console.log("[CACHE] Parsing seating Excel...");
    _cache.seating = buildSeatingWithParticipantMatch(getStaffGroups());
    console.log(`[CACHE] Cached seating: ${_cache.seating.summary.totalTables} tables.`);
  }
  return _cache.seating;
}

async function getParticipantsWithAttendance(staffGroups = getStaffGroups()) {
  const attendanceOverrides = await getCachedAttendanceOverrides(staffGroups);

  return staffGroups.map((staff) => {
    const loginCode = makeStaffLoginCode(staff.companyCode, staff.staffNo);
    const override = attendanceOverrides.get(loginCode);

    return {
      ...staff,
      attendance: override?.attendance || staff.attendance || "Belum daftar",
    };
  });
}

const ROOM_TYPE_COLUMNS = [
  { room: "Studio King", aliases: ["studio king"] },
  { room: "Jumbo", aliases: ["jumbo", "jumbo family"] },
  { room: "Family Tatami", aliases: ["family tatami"] },
  { room: "Studio Double Queen", aliases: ["studio double queen"] },
  { room: "Deluxe Suite", aliases: ["deluxe suite"] },
  { room: "Double Twin Suite", aliases: ["double twin suite", "double twin suite sharing"] },
  { room: "Studio Twin", aliases: ["studio twin", "studio twin suite"] },
];

function normalizeRoomTypeForDashboard(value) {
  const text = clean(value)
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";

  for (const def of ROOM_TYPE_COLUMNS) {
    if (def.aliases.some((alias) => text === alias || text.startsWith(`${alias} `))) {
      return def.room;
    }
  }

  return "";
}

function buildRoomsData(staffGroups = getStaffGroups()) {
  const result = Object.fromEntries(
    ROOM_TYPE_COLUMNS.map((def) => [
      def.room,
      {
        room: def.room,
        count: 0, // number of room units from Excel ROOM TYPE columns
        participantCount: 0,
        staff: [],
      },
    ])
  );

  // Attach staff/family groups to their canonical room type for drill-down.
  for (const staff of staffGroups) {
    const canonicalRoom = normalizeRoomTypeForDashboard(staff.room);
    if (!canonicalRoom || !result[canonicalRoom]) continue;

    result[canonicalRoom].participantCount += Number(staff.totalFamily || 0);
    result[canonicalRoom].staff.push({
      staffNo: staff.staffNo,
      staffName: staff.staffName,
      totalFamily: staff.totalFamily,
      isAwardRecipient: staff.isAwardRecipient,
      awardInfo: staff.awardInfo,
    });
  }

  // Dashboard Pecahan Bilik is authoritative from the 19.08.2026 workbook's
  // ROOM TYPE quantity columns (Studio King ... Studio Twin). This avoids
  // treating notes/merged-cell text in the free-form Room Type column as data.
  const workbook = safeReadWorkbook(staffFamilyFile);
  if (workbook) {
    for (const sheetName of ["SCS Room Detail", "SES Room Detail"]) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        blankrows: false,
        raw: true,
      });

      if (!rows || rows.length < 3) continue;

      const headers = rows[1] || [];
      const nameCol = headers.findIndex((value) => normalizeHeaderName(value) === "name");
      const roomCols = {};

      headers.forEach((value, index) => {
        const canonical = normalizeRoomTypeForDashboard(value);
        if (canonical && roomCols[canonical] == null) roomCols[canonical] = index;
      });

      for (let i = 2; i < rows.length; i++) {
        const row = rows[i] || [];

        // Summary/footer rows repeat the room totals but have no participant name.
        // Ignore them so the room quantities are not double-counted.
        if (nameCol >= 0 && !clean(row[nameCol])) continue;

        for (const def of ROOM_TYPE_COLUMNS) {
          const colIndex = roomCols[def.room];
          if (colIndex == null) continue;

          const numeric = Number(row[colIndex]);
          if (Number.isFinite(numeric) && numeric > 0) {
            result[def.room].count += numeric;
          }
        }
      }
    }
  }

  return ROOM_TYPE_COLUMNS.map((def) => result[def.room]);
}

function buildTeamsData(staffGroups = getStaffGroups()) {
  const teams = staffGroups.reduce((acc, staff) => {
    const team = staff.team || "Belum ditetapkan";

    if (!acc[team]) {
      acc[team] = {
        team,
        count: 0,
        players: [],
      };
    }

    acc[team].count += Number(staff.totalFamily || 0);

    acc[team].players.push({
      staffNo: staff.staffNo,
      staffName: staff.staffName,
      totalFamily: staff.totalFamily,
      isAwardRecipient: staff.isAwardRecipient,
      awardInfo: staff.awardInfo,
    });

    return acc;
  }, {});

  return Object.values(teams);
}

function ensureSupabaseForTelematch(res) {
  if (supabase) return true;

  res.status(500).json({
    success: false,
    message:
      "Supabase belum dikonfigurasi. Sila set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.",
  });

  return false;
}


function getOfficialTelematchGameDefinition(value) {
  const normalized = clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return DEFAULT_TELEMATCH_GAMES.find((game) => {
    const gameName = clean(game.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return normalized === gameName || normalized.includes(gameName) || gameName.includes(normalized);
  }) || null;
}

function formatTelematchGame(row, teamCounts = null) {
  const counts = {
    Green: Number(teamCounts?.Green || 0),
    Yellow: Number(teamCounts?.Yellow || 0),
    Red: Number(teamCounts?.Red || 0),
    Blue: Number(teamCounts?.Blue || 0),
  };

  const officialDefinition = getOfficialTelematchGameDefinition(row.name);

  return {
    id: row.id,
    name: clean(row.name),
    description: officialDefinition?.description || clean(row.description),
    category:
      officialDefinition?.category ||
      normalizeTelematchCategory(row.category),
    location: clean(row.location),
    startTime: clean(row.start_time),
    endTime: clean(row.end_time),
    maxTeamMembers: Number(row.max_team_members || 0),
    teamCounts: counts,
    totalRegistrations:
      counts.Green + counts.Yellow + counts.Red + counts.Blue,
    createdAt: clean(row.created_at),
    updatedAt: clean(row.updated_at),
  };
}

function formatTelematchParticipant(row, gameCount = 0) {
  return {
    id: row.id,
    name: clean(row.name),
    age: Number(row.age || 0),
    category: normalizeTelematchCategory(row.category),
    teamColor: normalizeTelematchTeamColor(row.team_color),
    ownerLoginCode: clean(row.owner_login_code).toUpperCase(),
    registeredGamesCount: Number(gameCount || 0),
    createdAt: clean(row.created_at),
    updatedAt: clean(row.updated_at),
  };
}

async function getTelematchRegistrationRows(gameIds = null) {
  let query = supabase
    .from("telematch_registrations")
    .select("id,participant_id,game_id,created_at");

  if (Array.isArray(gameIds) && gameIds.length > 0) {
    query = query.in("game_id", gameIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`TELEMATCH_REG_READ_FAILED:${error.message}`);
  }

  return data || [];
}

async function getTelematchParticipantsByIds(participantIds) {
  const unique = Array.from(new Set((participantIds || []).filter(Boolean)));
  if (unique.length === 0) return [];

  const { data, error } = await supabase
    .from("telematch_participants")
    .select("id,name,age,category,team_color,owner_login_code,created_at,updated_at")
    .in("id", unique);

  if (error) {
    throw new Error(`TELEMATCH_PARTICIPANT_READ_FAILED:${error.message}`);
  }

  return data || [];
}


function normalizeTelematchGameKey(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureDefaultTelematchGames() {
  const { data: existing, error: existingError } = await supabase
    .from("telematch_games")
    .select("id,name");

  if (existingError) {
    throw new Error(`TELEMATCH_GAME_READ_FAILED:${existingError.message}`);
  }

  // Cari Barang Tersembunyi is the official Kid Opening Game (age 3-7).

  // Normalize existing official game rows so stale category values such as
  // "Kids" cannot hide valid games from Staff View.
  for (const existingRow of existing || []) {
    const official = DEFAULT_TELEMATCH_GAMES.find(
      (game) =>
        normalizeTelematchGameKey(game.name) ===
        normalizeTelematchGameKey(existingRow.name)
    );

    if (!official) continue;

    const { error: updateError } = await supabase
      .from("telematch_games")
      .update({
        category: official.category,
        description: official.description,
        location: official.location,
        max_team_members: official.max_team_members,
      })
      .eq("id", existingRow.id);

    if (updateError) {
      console.warn(
        `[TELEMATCH] Unable to normalize game ${existingRow.name}:`,
        updateError.message
      );
    }
  }

  const existingKeys = new Set(
    (existing || []).map((row) => normalizeTelematchGameKey(row.name))
  );

  const missing = DEFAULT_TELEMATCH_GAMES.filter(
    (game) => !existingKeys.has(normalizeTelematchGameKey(game.name))
  );

  if (missing.length === 0) return;

  const { error: insertError } = await supabase
    .from("telematch_games")
    .insert(missing);

  if (insertError) {
    throw new Error(`TELEMATCH_DEFAULT_GAME_INSERT_FAILED:${insertError.message}`);
  }

  console.log(`[TELEMATCH] Added ${missing.length} missing default game(s).`);
}

async function getTelematchGamesWithStats() {
  const { data: games, error: gamesError } = await supabase
    .from("telematch_games")
    .select("id,name,description,category,location,start_time,end_time,max_team_members,created_at,updated_at")
    .order("created_at", { ascending: true });

  if (gamesError) {
    throw new Error(`TELEMATCH_GAME_READ_FAILED:${gamesError.message}`);
  }

  const gameRows = games || [];
  if (gameRows.length === 0) return [];

  const gameIds = gameRows.map((x) => x.id);
  const registrationRows = await getTelematchRegistrationRows(gameIds);
  const participantRows = await getTelematchParticipantsByIds(
    registrationRows.map((x) => x.participant_id)
  );
  const teamByParticipant = participantRows.reduce((acc, p) => {
    acc[p.id] = normalizeTelematchTeamColor(p.team_color);
    return acc;
  }, {});

  const countsByGame = gameIds.reduce((acc, gameId) => {
    acc[gameId] = { Green: 0, Yellow: 0, Red: 0, Blue: 0 };
    return acc;
  }, {});

  registrationRows.forEach((row) => {
    const team = teamByParticipant[row.participant_id];
    if (!team || !countsByGame[row.game_id]) return;
    countsByGame[row.game_id][team] += 1;
  });

  return gameRows.map((row) => formatTelematchGame(row, countsByGame[row.id]));
}

async function getTelematchParticipantsWithCounts() {
  const { data: participants, error: participantsError } = await supabase
    .from("telematch_participants")
    .select("id,name,age,category,team_color,owner_login_code,created_at,updated_at")
    .order("created_at", { ascending: true });

  if (participantsError) {
    throw new Error(`TELEMATCH_PARTICIPANT_READ_FAILED:${participantsError.message}`);
  }

  const participantRows = participants || [];
  if (participantRows.length === 0) return [];

  const participantIds = participantRows.map((x) => x.id);
  const { data: registrations, error: registrationsError } = await supabase
    .from("telematch_registrations")
    .select("participant_id")
    .in("participant_id", participantIds);

  if (registrationsError) {
    throw new Error(`TELEMATCH_REG_READ_FAILED:${registrationsError.message}`);
  }

  const countByParticipant = (registrations || []).reduce((acc, row) => {
    acc[row.participant_id] = Number(acc[row.participant_id] || 0) + 1;
    return acc;
  }, {});

  return participantRows.map((row) =>
    formatTelematchParticipant(row, countByParticipant[row.id] || 0)
  );
}

async function getParticipantRegistrationGameIds(participantId) {
  const { data, error } = await supabase
    .from("telematch_registrations")
    .select("game_id")
    .eq("participant_id", participantId);

  if (error) {
    throw new Error(`TELEMATCH_REG_READ_FAILED:${error.message}`);
  }

  return (data || []).map((x) => x.game_id);
}

function canParticipantJoinGame(participantCategory, gameCategory) {
  if (gameCategory === "Open") return true;
  return participantCategory === gameCategory;
}


const KID_TELEMATCH_AGE_RULES = [
  { name: "cari barang tersembunyi", minAge: 3, maxAge: 7, isOpeningGame: true },
  { name: "pindah air guna span", minAge: 4, maxAge: 8 },
  { name: "mumia wrap", minAge: 4, maxAge: 12 },
  { name: "berbaris mengikut arahan", minAge: 4, maxAge: 12 },
  { name: "tarik tali mini", minAge: 7, maxAge: 12 },
];

const ADULT_TELEMATCH_GAME_NAMES = [
  "lari kepit belon bawak bola ping pong dalam sudu",
  "4 x 50m lari berganti ganti",
  "dadu makan tuan",
  "bola pelikat",
];

function normalizeTelematchGameNameForRule(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getKidTelematchAgeRuleByName(value) {
  const normalized = normalizeTelematchGameNameForRule(value);

  return KID_TELEMATCH_AGE_RULES.find((rule) =>
    normalized.includes(normalizeTelematchGameNameForRule(rule.name))
  ) || null;
}

function isOfficialAdultTelematchGame(value) {
  const normalized = normalizeTelematchGameNameForRule(value);

  return ADULT_TELEMATCH_GAME_NAMES.some((name) =>
    normalized.includes(normalizeTelematchGameNameForRule(name))
  );
}

async function validateRegistrationRequest({ participant, gameIds, actorLoginCode }) {
  const uniqueGameIds = Array.from(new Set((gameIds || []).filter(Boolean)));

  const participantCategory = normalizeTelematchCategory(participant.category);

  // Adult remains maximum 1 game. Kid limit is checked after game names are
  // loaded because the Opening Game does not count toward the 2 main games.
  if (participantCategory !== "Kid" && uniqueGameIds.length > 1) {
    throw new Error("MAX_1_GAME_ADULT");
  }

  if (actorLoginCode) {
    const owner = clean(participant.owner_login_code).toUpperCase();
    if (!owner || owner !== clean(actorLoginCode).toUpperCase()) {
      throw new Error("STAFF_FAMILY_ONLY");
    }
  }

  if (uniqueGameIds.length === 0) {
    return [];
  }

  const { data: games, error: gamesError } = await supabase
    .from("telematch_games")
    .select("id,name,category,max_team_members")
    .in("id", uniqueGameIds);

  if (gamesError) {
    throw new Error(`TELEMATCH_GAME_READ_FAILED:${gamesError.message}`);
  }

  const gameRows = games || [];

  if (gameRows.length !== uniqueGameIds.length) {
    throw new Error("GAME_NOT_FOUND");
  }

  if (participantCategory === "Kid") {
    const normalKidGames = gameRows.filter((game) => {
      const rule = getKidTelematchAgeRuleByName(game.name);
      return rule && !rule.isOpeningGame;
    });

    if (normalKidGames.length > 2) {
      throw new Error("MAX_2_GAMES_KID");
    }
  }

  const normalizedParticipantCategory = participantCategory;

  gameRows.forEach((game) => {
    const gameCategory =
      getOfficialTelematchGameDefinition(game.name)?.category ||
      normalizeTelematchCategory(game.category);

    if (!canParticipantJoinGame(normalizedParticipantCategory, gameCategory)) {
      throw new Error("CATEGORY_MISMATCH");
    }

    if (normalizedParticipantCategory === "Kid") {
      const age = Number(participant.age || 0);
      const rule = getKidTelematchAgeRuleByName(game.name);

      // Kid registration is allowed only for the five official Kid games, including the Opening Game.
      if (!rule) {
        throw new Error("KID_GAME_NOT_OFFICIAL");
      }

      if (!Number.isFinite(age) || age < 3 || age > 12) {
        throw new Error("KID_AGE_CATEGORY_INVALID");
      }

      if (age < rule.minAge || age > rule.maxAge) {
        throw new Error("KID_GAME_AGE_MISMATCH");
      }
    }

    if (
      normalizedParticipantCategory === "Adult" &&
      !isOfficialAdultTelematchGame(game.name)
    ) {
      throw new Error("ADULT_GAME_NOT_OFFICIAL");
    }
  });

  const registrationRows = await getTelematchRegistrationRows(uniqueGameIds);
  const otherRows = registrationRows.filter(
    (row) => row.participant_id !== participant.id
  );

  const participantRows = await getTelematchParticipantsByIds(
    otherRows.map((x) => x.participant_id)
  );

  const teamByParticipant = participantRows.reduce((acc, p) => {
    acc[p.id] = normalizeTelematchTeamColor(p.team_color);
    return acc;
  }, {});

  const countsByGame = uniqueGameIds.reduce((acc, gameId) => {
    acc[gameId] = { Green: 0, Yellow: 0, Red: 0, Blue: 0 };
    return acc;
  }, {});

  otherRows.forEach((row) => {
    const team = teamByParticipant[row.participant_id];
    if (!team || !countsByGame[row.game_id]) return;
    countsByGame[row.game_id][team] += 1;
  });

  const participantTeamColor = normalizeTelematchTeamColor(participant.team_color);

  gameRows.forEach((game) => {
    const limit = Number(game.max_team_members || 10);
    if (limit <= 0) return;

    const currentCount = Number(
      countsByGame[game.id]?.[participantTeamColor] || 0
    );

    if (currentCount + 1 > limit) {
      throw new Error("TEAM_QUOTA_FULL");
    }
  });

  return uniqueGameIds;
}

async function updateParticipantRegistrations(participantId, requestedGameIds, actorLoginCode = "") {
  const { data: participant, error: participantError } = await supabase
    .from("telematch_participants")
    .select("id,category,team_color,owner_login_code")
    .eq("id", participantId)
    .maybeSingle();

  if (participantError) {
    throw new Error(`TELEMATCH_PARTICIPANT_READ_FAILED:${participantError.message}`);
  }

  if (!participant) {
    throw new Error("PARTICIPANT_NOT_FOUND");
  }

  const validGameIds = await validateRegistrationRequest({
    participant,
    gameIds: requestedGameIds,
    actorLoginCode,
  });

  const existingIds = await getParticipantRegistrationGameIds(participantId);
  const toAdd = validGameIds.filter((id) => !existingIds.includes(id));
  const toDelete = existingIds.filter((id) => !validGameIds.includes(id));

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("telematch_registrations")
      .delete()
      .eq("participant_id", participantId)
      .in("game_id", toDelete);

    if (deleteError) {
      throw new Error(`TELEMATCH_REG_DELETE_FAILED:${deleteError.message}`);
    }
  }

  if (toAdd.length > 0) {
    const payload = toAdd.map((gameId) => ({
      participant_id: participantId,
      game_id: gameId,
    }));

    const { error: insertError } = await supabase
      .from("telematch_registrations")
      .insert(payload);

    if (insertError) {
      throw new Error(`TELEMATCH_REG_INSERT_FAILED:${insertError.message}`);
    }
  }

  return getParticipantRegistrationGameIds(participantId);
}

/* =========================
   API ROUTES
========================= */

app.get("/", (req, res) => {
  res.json({
    message: "Family Day 2026 Admin API running",
    isVercel: IS_VERCEL,
    supabaseConfigured: !!supabase,
    staffFamilyFileExists: fs.existsSync(staffFamilyFile),
    staffFamilyFileName: path.basename(staffFamilyFile),
    roomFileExists: fs.existsSync(roomFile),
    foodSeatingFileExists: fs.existsSync(foodSeatingFile),
    longServiceSCSFileExists: fs.existsSync(longServiceSCSFile),
    longServiceSESFileExists: fs.existsSync(longServiceSESFile),
  });
});

app.post("/api/cache/clear", (req, res) => {
  clearExcelCache();
  clearAttendanceCache();
  res.json({ success: true, message: "Cache cleared. Next request will re-parse Excel." });
});


/* =========================
   KARAOKE REGISTRATION
========================= */

const karaokeRegistrationFile = path.join(__dirname, "karaoke_registrations.json");

function readKaraokeRegistrations() {
  try {
    if (!fs.existsSync(karaokeRegistrationFile)) return [];
    const raw = fs.readFileSync(karaokeRegistrationFile, "utf8");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("[KARAOKE] Unable to read registrations:", error.message);
    return [];
  }
}

function writeKaraokeRegistrations(rows) {
  fs.writeFileSync(
    karaokeRegistrationFile,
    JSON.stringify(Array.isArray(rows) ? rows : [], null, 2),
    "utf8"
  );
}

app.get("/api/karaoke/registration", (req, res) => {
  const companyCode = String(req.query.companyCode || "").trim().toUpperCase();
  const staffNo = String(req.query.staffNo || "").trim().toUpperCase();
  const participantKey = String(req.query.participantKey || "").trim();

  if (!companyCode || !staffNo || !participantKey) {
    return res.status(400).json({
      success: false,
      message: "companyCode, staffNo dan participantKey diperlukan.",
    });
  }

  const rows = readKaraokeRegistrations();
  const found = rows.find(
    (row) =>
      String(row.companyCode || "").toUpperCase() === companyCode &&
      String(row.staffNo || "").toUpperCase() === staffNo &&
      String(row.participantKey || "") === participantKey
  );

  return res.json({
    success: true,
    data: found || null,
  });
});

app.put("/api/karaoke/registration", (req, res) => {
  const companyCode = String(req.body?.companyCode || "").trim().toUpperCase();
  const staffNo = String(req.body?.staffNo || "").trim().toUpperCase();
  const participantKey = String(req.body?.participantKey || "").trim();
  const participantName = String(req.body?.participantName || "").trim();
  const relation = String(req.body?.relation || "").trim();
  const song1 = String(req.body?.song1 || "").trim();
  const song2 = String(req.body?.song2 || "").trim();

  if (!companyCode || !staffNo || !participantKey || !participantName) {
    return res.status(400).json({
      success: false,
      message: "Maklumat peserta karaoke tidak lengkap.",
    });
  }

  const songs = [song1, song2].filter(Boolean);

  if (songs.length < 1 || songs.length > 2) {
    return res.status(400).json({
      success: false,
      message: "Pilih minimum 1 dan maksimum 2 lagu.",
    });
  }

  const rows = readKaraokeRegistrations();
  const key = `${companyCode}|${staffNo}|${participantKey}`;
  const now = new Date().toISOString();

  const record = {
    key,
    companyCode,
    staffNo,
    participantKey,
    participantName,
    relation,
    song1,
    song2,
    updatedAt: now,
  };

  const index = rows.findIndex((row) => String(row.key || "") === key);

  if (index >= 0) rows[index] = record;
  else rows.push(record);

  try {
    writeKaraokeRegistrations(rows);
  } catch (error) {
    console.error("[KARAOKE] Save failed:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal simpan pendaftaran karaoke.",
    });
  }

  return res.json({
    success: true,
    data: record,
  });
});

app.get("/api/telematch/meta", (req, res) => {
  res.json({
    success: true,
    data: {
      categories: TELEMATCH_CATEGORIES,
      teams: TELEMATCH_TEAM_COLORS,
      maxGamesPerParticipant: { Adult: 1, Kid: 2 },
    },
  });
});

app.get("/api/telematch/games", async (req, res) => {
  if (!ensureSupabaseForTelematch(res)) return;

  try {
    await ensureDefaultTelematchGames();
    const games = await getTelematchGamesWithStats();

    // Only expose the eight official registration games to Staff View.
    const officialKeys = new Set(
      DEFAULT_TELEMATCH_GAMES.map((game) => normalizeTelematchGameKey(game.name))
    );

    const officialGames = games.filter((game) =>
      officialKeys.has(normalizeTelematchGameKey(game.name))
    );

    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({ success: true, data: officialGames });
  } catch (error) {
    console.error("Telematch games read error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal muatkan data game telematch.",
    });
  }
});

app.get("/api/telematch/games/:gameId/participants", async (req, res) => {
  if (!ensureSupabaseForTelematch(res)) return;

  const gameId = clean(req.params.gameId);

  if (!gameId) {
    return res.status(400).json({ success: false, message: "Game ID diperlukan." });
  }

  try {
    const { data: game, error: gameError } = await supabase
      .from("telematch_games")
      .select("id,name,category,location,start_time,end_time,max_team_members")
      .eq("id", gameId)
      .maybeSingle();

    if (gameError) throw gameError;

    if (!game) {
      return res.status(404).json({ success: false, message: "Game tidak dijumpai." });
    }

    const registrationRows = await getTelematchRegistrationRows([gameId]);
    const participantRows = await getTelematchParticipantsByIds(
      registrationRows.map((row) => row.participant_id)
    );

    const participantsById = participantRows.reduce((acc, row) => {
      acc[row.id] = row;
      return acc;
    }, {});

    const participants = registrationRows
      .map((row) => participantsById[row.participant_id])
      .filter(Boolean)
      .map((row) => formatTelematchParticipant(row))
      .sort((a, b) => {
        const teamCompare = String(a.teamColor || "").localeCompare(
          String(b.teamColor || ""),
          undefined,
          { sensitivity: "base" }
        );

        if (teamCompare !== 0) return teamCompare;

        return String(a.name || "").localeCompare(String(b.name || ""), undefined, {
          sensitivity: "base",
        });
      });

    return res.json({
      success: true,
      data: {
        game: formatTelematchGame(game),
        participants,
      },
    });
  } catch (error) {
    console.error("Telematch game participants read error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal muatkan senarai peserta game.",
    });
  }
});

app.post("/api/telematch/games", async (req, res) => {
  if (!ensureSupabaseForTelematch(res)) return;

  const name = clean(req.body.name);
  const description = clean(req.body.description);
  const location = clean(req.body.location);
  const startTime = clean(req.body.startTime);
  const endTime = clean(req.body.endTime);
  const category = normalizeTelematchCategory(req.body.category);
  const maxTeamMembers = Number(req.body.maxTeamMembers || 0);

  if (!name) {
    return res.status(400).json({ success: false, message: "Nama game diperlukan." });
  }

  if (!TELEMATCH_CATEGORIES.includes(category)) {
    return res.status(400).json({ success: false, message: "Kategori game tidak sah." });
  }

  if (!Number.isInteger(maxTeamMembers) || maxTeamMembers <= 0) {
    return res.status(400).json({
      success: false,
      message: "Max Team Members mesti nombor integer lebih besar daripada 0.",
    });
  }

  try {
    const { data, error } = await supabase
      .from("telematch_games")
      .insert({
        name,
        description,
        category,
        location,
        start_time: startTime || null,
        end_time: endTime || null,
        max_team_members: maxTeamMembers,
      })
      .select("id,name,description,category,location,start_time,end_time,max_team_members,created_at,updated_at")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return res.status(201).json({
      success: true,
      data: formatTelematchGame(data),
    });
  } catch (error) {
    console.error("Telematch game create error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal cipta game telematch.",
    });
  }
});

app.put("/api/telematch/games/:gameId", async (req, res) => {
  if (!ensureSupabaseForTelematch(res)) return;

  const gameId = clean(req.params.gameId);
  const name = clean(req.body.name);
  const description = clean(req.body.description);
  const location = clean(req.body.location);
  const startTime = clean(req.body.startTime);
  const endTime = clean(req.body.endTime);
  const category = normalizeTelematchCategory(req.body.category);
  const maxTeamMembers = Number(req.body.maxTeamMembers || 0);

  if (!gameId) {
    return res.status(400).json({ success: false, message: "Game ID diperlukan." });
  }

  if (!name) {
    return res.status(400).json({ success: false, message: "Nama game diperlukan." });
  }

  if (!TELEMATCH_CATEGORIES.includes(category)) {
    return res.status(400).json({ success: false, message: "Kategori game tidak sah." });
  }

  if (!Number.isInteger(maxTeamMembers) || maxTeamMembers <= 0) {
    return res.status(400).json({
      success: false,
      message: "Max Team Members mesti nombor integer lebih besar daripada 0.",
    });
  }

  try {
    const { data, error } = await supabase
      .from("telematch_games")
      .update({
        name,
        description,
        category,
        location,
        start_time: startTime || null,
        end_time: endTime || null,
        max_team_members: maxTeamMembers,
      })
      .eq("id", gameId)
      .select("id,name,description,category,location,start_time,end_time,max_team_members,created_at,updated_at")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, message: "Game tidak dijumpai." });
    }

    return res.json({ success: true, data: formatTelematchGame(data) });
  } catch (error) {
    console.error("Telematch game update error:", error);
    return res.status(500).json({ success: false, message: "Gagal kemaskini game telematch." });
  }
});

app.delete("/api/telematch/games/:gameId", async (req, res) => {
  if (!ensureSupabaseForTelematch(res)) return;

  const gameId = clean(req.params.gameId);
  if (!gameId) {
    return res.status(400).json({ success: false, message: "Game ID diperlukan." });
  }

  try {
    await supabase.from("telematch_registrations").delete().eq("game_id", gameId);

    const { error } = await supabase.from("telematch_games").delete().eq("id", gameId);
    if (error) throw error;

    return res.json({ success: true, message: "Game berjaya dipadam." });
  } catch (error) {
    console.error("Telematch game delete error:", error);
    return res.status(500).json({ success: false, message: "Gagal padam game telematch." });
  }
});

app.get("/api/telematch/participants", async (req, res) => {
  if (!ensureSupabaseForTelematch(res)) return;

  try {
    const participants = await getTelematchParticipantsWithCounts();
    res.json({ success: true, data: participants });
  } catch (error) {
    console.error("Telematch participants read error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal muatkan data peserta telematch.",
    });
  }
});

app.post("/api/telematch/participants", async (req, res) => {
  if (!ensureSupabaseForTelematch(res)) return;

  const name = clean(req.body.name);
  const age = Number(req.body.age || 0);
  const category = normalizeTelematchCategory(req.body.category);
  const teamColor = normalizeTelematchTeamColor(req.body.teamColor);
  const ownerLoginCode = clean(req.body.ownerLoginCode).toUpperCase();

  if (!name) {
    return res.status(400).json({ success: false, message: "Nama peserta diperlukan." });
  }

  if (!Number.isInteger(age) || age < 0) {
    return res.status(400).json({ success: false, message: "Umur tidak sah." });
  }

  if (!TELEMATCH_CATEGORIES.includes(category)) {
    return res.status(400).json({ success: false, message: "Kategori peserta tidak sah." });
  }

  if (!TELEMATCH_TEAM_COLORS.includes(teamColor)) {
    return res.status(400).json({ success: false, message: "Warna rumah tidak sah." });
  }

  try {
    const { data, error } = await supabase
      .from("telematch_participants")
      .insert({
        name,
        age,
        category,
        team_color: teamColor,
        owner_login_code: ownerLoginCode || null,
      })
      .select("id,name,age,category,team_color,owner_login_code,created_at,updated_at")
      .maybeSingle();

    if (error) throw error;

    return res.status(201).json({ success: true, data: formatTelematchParticipant(data, 0) });
  } catch (error) {
    console.error("Telematch participant create error:", error);
    return res.status(500).json({ success: false, message: "Gagal cipta peserta telematch." });
  }
});

app.put("/api/telematch/participants/:participantId", async (req, res) => {
  if (!ensureSupabaseForTelematch(res)) return;

  const participantId = clean(req.params.participantId);
  const name = clean(req.body.name);
  const age = Number(req.body.age || 0);
  const category = normalizeTelematchCategory(req.body.category);
  const teamColor = normalizeTelematchTeamColor(req.body.teamColor);
  const ownerLoginCode = clean(req.body.ownerLoginCode).toUpperCase();

  if (!participantId) {
    return res.status(400).json({ success: false, message: "Participant ID diperlukan." });
  }

  if (!name) {
    return res.status(400).json({ success: false, message: "Nama peserta diperlukan." });
  }

  if (!Number.isInteger(age) || age < 0) {
    return res.status(400).json({ success: false, message: "Umur tidak sah." });
  }

  if (!TELEMATCH_CATEGORIES.includes(category)) {
    return res.status(400).json({ success: false, message: "Kategori peserta tidak sah." });
  }

  if (!TELEMATCH_TEAM_COLORS.includes(teamColor)) {
    return res.status(400).json({ success: false, message: "Warna rumah tidak sah." });
  }

  try {
    const { data, error } = await supabase
      .from("telematch_participants")
      .update({
        name,
        age,
        category,
        team_color: teamColor,
        owner_login_code: ownerLoginCode || null,
      })
      .eq("id", participantId)
      .select("id,name,age,category,team_color,owner_login_code,created_at,updated_at")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, message: "Peserta tidak dijumpai." });
    }

    const registrationIds = await getParticipantRegistrationGameIds(participantId);
    return res.json({
      success: true,
      data: formatTelematchParticipant(data, registrationIds.length),
    });
  } catch (error) {
    console.error("Telematch participant update error:", error);
    return res.status(500).json({ success: false, message: "Gagal kemaskini peserta telematch." });
  }
});

app.delete("/api/telematch/participants/:participantId", async (req, res) => {
  if (!ensureSupabaseForTelematch(res)) return;

  const participantId = clean(req.params.participantId);
  if (!participantId) {
    return res.status(400).json({ success: false, message: "Participant ID diperlukan." });
  }

  try {
    await supabase
      .from("telematch_registrations")
      .delete()
      .eq("participant_id", participantId);

    const { error } = await supabase
      .from("telematch_participants")
      .delete()
      .eq("id", participantId);

    if (error) throw error;

    return res.json({ success: true, message: "Peserta berjaya dipadam." });
  } catch (error) {
    console.error("Telematch participant delete error:", error);
    return res.status(500).json({ success: false, message: "Gagal padam peserta telematch." });
  }
});

app.get("/api/telematch/participants/:participantId/registrations", async (req, res) => {
  if (!ensureSupabaseForTelematch(res)) return;

  const participantId = clean(req.params.participantId);
  if (!participantId) {
    return res.status(400).json({ success: false, message: "Participant ID diperlukan." });
  }

  try {
    const gameIds = await getParticipantRegistrationGameIds(participantId);
    return res.json({ success: true, data: { participantId, gameIds } });
  } catch (error) {
    console.error("Telematch registrations read error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal muatkan pendaftaran game peserta.",
    });
  }
});

app.put("/api/telematch/participants/:participantId/registrations", async (req, res) => {
  if (!ensureSupabaseForTelematch(res)) return;

  const participantId = clean(req.params.participantId);
  const gameIds = Array.isArray(req.body.gameIds) ? req.body.gameIds : [];
  const actorLoginCode = clean(req.body.actorLoginCode).toUpperCase();

  if (!participantId) {
    return res.status(400).json({ success: false, message: "Participant ID diperlukan." });
  }

  try {
    const updatedGameIds = await updateParticipantRegistrations(
      participantId,
      gameIds,
      actorLoginCode
    );

    return res.json({
      success: true,
      data: {
        participantId,
        gameIds: updatedGameIds,
      },
    });
  } catch (error) {
    if (error.message === "PARTICIPANT_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Peserta tidak dijumpai." });
    }

    if (error.message === "MAX_3_GAMES" || error.message === "MAX_2_GAMES_KID" || error.message === "MAX_1_GAME_ADULT") {
      return res.status(400).json({
        success: false,
        message: "Adult maksimum 1 game dan Kid maksimum 2 game.",
      });
    }

    if (error.message === "CATEGORY_MISMATCH") {
      return res.status(400).json({
        success: false,
        message: "Kategori peserta tidak sepadan dengan kategori game.",
      });
    }

    if (error.message === "TEAM_QUOTA_FULL") {
      return res.status(400).json({
        success: false,
        message: "Kuota ahli pasukan untuk game ini telah penuh.",
      });
    }

    if (error.message === "STAFF_FAMILY_ONLY") {
      return res.status(403).json({
        success: false,
        message: "Staff hanya boleh mendaftar ahli keluarga sendiri.",
      });
    }

    if (error.message === "GAME_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Game tidak dijumpai." });
    }

    console.error("Telematch registrations update error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal kemaskini pendaftaran game peserta.",
    });
  }
});

app.get("/api/telematch/staff/:companyCode/:staffNo/participants", async (req, res) => {
  if (!ensureSupabaseForTelematch(res)) return;

  const companyCode = clean(req.params.companyCode).toUpperCase();
  const staffNo = normalizeStaffNo(req.params.staffNo);
  const loginCode = makeStaffLoginCode(companyCode, staffNo);

  try {
    const participants = await getTelematchParticipantsWithCounts();
    const scoped = participants.filter((x) => x.ownerLoginCode === loginCode);
    return res.json({ success: true, data: scoped });
  } catch (error) {
    console.error("Telematch staff participants read error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal muatkan peserta keluarga staff.",
    });
  }
});

app.put(
  "/api/telematch/staff/:companyCode/:staffNo/participants/:participantId/registrations",
  async (req, res) => {
    if (!ensureSupabaseForTelematch(res)) return;

    const companyCode = clean(req.params.companyCode).toUpperCase();
    const staffNo = normalizeStaffNo(req.params.staffNo);
    const participantId = clean(req.params.participantId);
    const gameIds = Array.isArray(req.body.gameIds) ? req.body.gameIds : [];
    const loginCode = makeStaffLoginCode(companyCode, staffNo);

    if (!participantId) {
      return res.status(400).json({ success: false, message: "Participant ID diperlukan." });
    }

    try {
      const updatedGameIds = await updateParticipantRegistrations(
        participantId,
        gameIds,
        loginCode
      );

      return res.json({
        success: true,
        data: { participantId, gameIds: updatedGameIds },
      });
    } catch (error) {
      if (error.message === "STAFF_FAMILY_ONLY") {
        return res.status(403).json({
          success: false,
          message: "Staff hanya boleh mendaftar ahli keluarga sendiri.",
        });
      }

      if (error.message === "MAX_3_GAMES" || error.message === "MAX_2_GAMES_KID" || error.message === "MAX_1_GAME_ADULT") {
        return res.status(400).json({
          success: false,
          message: "Adult maksimum 1 game dan Kid maksimum 2 game.",
        });
      }

      if (error.message === "CATEGORY_MISMATCH") {
        return res.status(400).json({
          success: false,
          message: "Kategori peserta tidak sepadan dengan kategori game.",
        });
      }

      if (error.message === "TEAM_QUOTA_FULL") {
        return res.status(400).json({
          success: false,
          message: "Kuota ahli pasukan untuk game ini telah penuh.",
        });
      }

      console.error("Telematch staff registrations update error:", error);
      return res.status(500).json({
        success: false,
        message: "Gagal kemaskini pendaftaran game keluarga staff.",
      });
    }
  }
);

/* ---------- member-registrations (admin upsert flow) ---------- */

app.get("/api/telematch/member-registrations", async (req, res) => {
  if (!ensureSupabaseForTelematch(res)) return;

  const ownerLoginCode = clean(req.query.ownerLoginCode).toUpperCase();
  const name = clean(req.query.name);

  if (!ownerLoginCode || !name) {
    return res.json({ success: true, data: { gameIds: [], participantId: null } });
  }

  try {
    const { data: participant, error } = await supabase
      .from("telematch_participants")
      .select("id")
      .eq("owner_login_code", ownerLoginCode)
      .ilike("name", name)
      .maybeSingle();

    if (error) throw error;

    if (!participant) {
      return res.json({ success: true, data: { gameIds: [], participantId: null } });
    }

    const gameIds = await getParticipantRegistrationGameIds(participant.id);
    return res.json({ success: true, data: { gameIds, participantId: participant.id } });
  } catch (error) {
    console.error("Member registrations read error:", error);
    return res.status(500).json({ success: false, message: "Gagal muatkan pendaftaran." });
  }
});

app.put("/api/telematch/member-registrations", async (req, res) => {
  if (!ensureSupabaseForTelematch(res)) return;

  const ownerLoginCode = clean(req.body.ownerLoginCode).toUpperCase();
  const name = clean(req.body.name);
  const age = Number(req.body.age || 0);
  const category = normalizeTelematchCategory(req.body.category);
  const teamColor = normalizeTelematchTeamColor(req.body.teamColor);
  const gameIds = Array.isArray(req.body.gameIds) ? req.body.gameIds.map(String) : [];

  if (!name) {
    return res.status(400).json({ success: false, message: "Nama peserta diperlukan." });
  }

  try {
    // Find or create participant
    const { data: existing, error: findErr } = await supabase
      .from("telematch_participants")
      .select("id")
      .eq("owner_login_code", ownerLoginCode)
      .ilike("name", name)
      .maybeSingle();

    if (findErr) throw findErr;

    let participantId;

    if (existing) {
      const { error: updErr } = await supabase
        .from("telematch_participants")
        .update({ age, category, team_color: teamColor, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (updErr) throw updErr;
      participantId = existing.id;
    } else {
      const { data: created, error: createErr } = await supabase
        .from("telematch_participants")
        .insert({ name, age, category, team_color: teamColor, owner_login_code: ownerLoginCode })
        .select("id")
        .maybeSingle();
      if (createErr) throw createErr;
      participantId = created.id;
    }

    const result = await updateParticipantRegistrations(participantId, gameIds);
    return res.json({ success: true, data: result });
  } catch (error) {
    const msg = String(error.message || "");
    if (msg === "MAX_3_GAMES") {
      return res.status(400).json({ success: false, message: "Peserta sudah mencapai had maksimum 3 game.", code: "MAX_3_GAMES" });
    }
    if (msg === "CATEGORY_MISMATCH") {
      return res.status(400).json({ success: false, message: "Kategori peserta tidak sepadan dengan kategori game.", code: "CATEGORY_MISMATCH" });
    }
    if (msg === "TEAM_QUOTA_FULL") {
      return res.status(400).json({ success: false, message: "Kuota team untuk game ini telah penuh.", code: "TEAM_QUOTA_FULL" });
    }
    console.error("Member registrations save error:", error);
    return res.status(500).json({ success: false, message: "Gagal kemaskini pendaftaran." });
  }
});

app.get("/api/attendance/stats", async (req, res) => {
  try {
    const summary = await getAttendanceSummaryFromSupabase();
    res.json({
      success: true,
      data: {
        totalStaff: summary.totalStaff,
        attendance: summary.attendance,
        attendancePercent: summary.attendancePercent,
        notAttended: summary.totalStaff - summary.attendance,
      },
    });
  } catch (error) {
    console.error("Attendance stats error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal muatkan statistik kehadiran.",
    });
  }
});

app.get("/api/all", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    const staffGroups = getStaffGroups();
    const [summary, participants] = await Promise.all([
      getAttendanceSummaryFromSupabase(),
      getParticipantsWithAttendance(staffGroups),
    ]);
    const seating = getCachedSeating();

    res.json({
      success: true,
      data: {
        summary,
        participants,
        confirmedNonParticipants: loadConfirmedNonParticipants(),
        rooms: buildRoomsData(staffGroups),
        teams: buildTeamsData(staffGroups),
        seating: {
          data: seating.tables,
          seats: seating.seats,
          summary: seating.summary,
        },
      },
    });
  } catch (error) {
    console.error("All data error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal muatkan data.",
    });
  }
});

app.get("/api/awards", (req, res) => {
  const longService = getCachedLongService();

  res.json({
    success: true,
    data: longService.awards,
    summary: {
      totalAwards: longService.awards.length,
      scs: longService.awards.filter((x) => x.companyCode === "SCS").length,
      ses: longService.awards.filter((x) => x.companyCode === "SES").length,
      byServiceYears: [15, 20, 25, 30].map((years) => ({
        years,
        count: longService.awards.filter((x) => x.yearsOfService === years).length,
      })),
    },
  });
});

app.get("/api/debug/supabase", async (req, res) => {
  if (!isDebugAuthorized(req)) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized debug access.",
    });
  }

  if (!supabase) {
    return res.status(500).json({
      success: false,
      message: "Supabase not configured.",
      diagnostics: {
        isVercel: IS_VERCEL,
        supabaseConfigured: false,
        hasSupabaseUrl: !!SUPABASE_URL,
        hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY,
      },
    });
  }

  try {
    const { error, count } = await supabase
      .from("staff_attendance_overrides")
      .select("login_code", { count: "exact", head: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Supabase query failed.",
        diagnostics: {
          isVercel: IS_VERCEL,
          supabaseConfigured: true,
          table: "staff_attendance_overrides",
          error: {
            message: error.message,
            code: error.code || "",
            details: error.details || "",
            hint: error.hint || "",
          },
        },
      });
    }

    return res.json({
      success: true,
      message: "Supabase connectivity OK.",
      diagnostics: {
        isVercel: IS_VERCEL,
        supabaseConfigured: true,
        table: "staff_attendance_overrides",
        rowCount: Number(count || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unexpected Supabase debug failure.",
      diagnostics: {
        isVercel: IS_VERCEL,
        supabaseConfigured: true,
        error: clean(error.message),
      },
    });
  }
});


/* =========================
   STAFF PWA LOGIN + PROFILE
========================= */

const staffAttendanceOverrideFile = path.join(
  __dirname,
  "data",
  "staff-attendance-overrides.json"
);

function loadAttendanceOverrides() {
  try {
    if (!fs.existsSync(staffAttendanceOverrideFile)) return {};
    return JSON.parse(fs.readFileSync(staffAttendanceOverrideFile, "utf8"));
  } catch (error) {
    console.warn("[WARN] Failed to load attendance overrides:", error.message);
    return {};
  }
}

function saveAttendanceOverrides(data) {
  try {
    fs.writeFileSync(
      staffAttendanceOverrideFile,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (error) {
    console.warn("[WARN] Failed to save attendance overrides:", error.message);
  }
}

function normalizeLoginGroupStaffNo(companyCode, staffNo) {
  const group = clean(companyCode).toUpperCase();
  let normalized = normalizeStaffNo(staffNo).toUpperCase();

  if (!normalized) return "";

  if (group === "DV") {
    normalized = normalized.replace(/^DV/i, "");
    return `DV${normalized.replace(/^0+(?=\d)/, "").padStart(3, "0")}`;
  }

  if (group === "TRAINEE") {
    normalized = normalized.replace(/^T/i, "");
    return `T${normalized.replace(/^0+(?=\d)/, "")}`;
  }

  return normalized;
}

function resolveLoginCompanyCode(companyCode) {
  const group = clean(companyCode).toUpperCase();

  // DV and Trainee participants are stored in the current authoritative
  // workbook under SCS Room Detail. Keep their user-facing login group while
  // resolving the existing staff record through SCS internally.
  if (group === "DV" || group === "TRAINEE") return "SCS";

  return group;
}

function makeStaffLoginCode(companyCode, staffNo) {
  return `${clean(companyCode).toUpperCase()}-${normalizeStaffNo(staffNo)}`;
}

// One approved dual-login household only.
// Ernawati (SCS-390) is the staff owner; her husband Mohd Holi (DV020) may
// sign in with his own DV login but must open the SAME family household.
// Keep their real relationship labels: Ernawati = Staff, Mohd Holi = Husband.
const SPECIAL_LINKED_FAMILY_LOGINS = new Map([
  [
    "SCS-DV020",
    {
      householdCompanyCode: "SCS",
      householdStaffNo: "390",
      loginPersonName: "Mohd Holi Bin Hanafiah",
      loginPersonRelation: "Husband",
      displayLoginGroup: "DV",
      displayStaffNo: "020",
    },
  ],
]);

function resolveSpecialLinkedFamilyLogin(companyCode, staffNo) {
  const requestedCode = makeStaffLoginCode(companyCode, staffNo);
  return SPECIAL_LINKED_FAMILY_LOGINS.get(requestedCode) || null;
}

function getLoginCodesFromStaffGroups(staffGroups) {
  return (staffGroups || [])
    .map((staff) => makeStaffLoginCode(staff.companyCode, staff.staffNo))
    .filter(Boolean);
}

async function fetchAttendanceOverridesByLoginCodes(loginCodes) {
  const uniqueCodes = Array.from(new Set((loginCodes || []).filter(Boolean)));

  if (uniqueCodes.length === 0) {
    return new Map();
  }

  if (supabase) {
    const byLoginCode = new Map();
    const chunkSize = 200;

    for (let i = 0; i < uniqueCodes.length; i += chunkSize) {
      const chunk = uniqueCodes.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from("staff_attendance_overrides")
        .select("login_code,attendance,updated_at")
        .in("login_code", chunk);

      if (error) {
        console.warn("[WARN] Failed to load attendance from Supabase:", error.message);

        if (IS_VERCEL) {
          throw new Error("SUPABASE_READ_FAILED");
        }

        return new Map();
      }

      (data || []).forEach((row) => {
        const loginCode = clean(row.login_code).toUpperCase();

        if (!loginCode) return;

        byLoginCode.set(loginCode, {
          attendance: clean(row.attendance),
          updatedAt: clean(row.updated_at),
        });
      });
    }

    return byLoginCode;
  }

  if (IS_VERCEL) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const attendanceOverrides = loadAttendanceOverrides();
  const byLoginCode = new Map();

  uniqueCodes.forEach((code) => {
    const record = attendanceOverrides[code] || attendanceOverrides[code.toUpperCase()];

    if (!record) return;

    byLoginCode.set(code.toUpperCase(), {
      attendance: clean(record.attendance),
      updatedAt: clean(record.updatedAt || record.updated_at),
    });
  });

  return byLoginCode;
}

async function getCachedAttendanceOverrides(staffGroups) {
  const now = Date.now();

  if (_cache.attendanceOverrides && now < _cache.attendanceOverridesExpiresAt) {
    return _cache.attendanceOverrides;
  }

  if (_cache.attendanceOverridesPromise) {
    return _cache.attendanceOverridesPromise;
  }

  const loginCodes = getLoginCodesFromStaffGroups(staffGroups);

  _cache.attendanceOverridesPromise = (async () => {
    const byLoginCode = await fetchAttendanceOverridesByLoginCodes(loginCodes);
    _cache.attendanceOverrides = byLoginCode;
    _cache.attendanceOverridesExpiresAt = Date.now() + ATTENDANCE_CACHE_TTL_MS;
    return byLoginCode;
  })();

  try {
    return await _cache.attendanceOverridesPromise;
  } finally {
    _cache.attendanceOverridesPromise = null;
  }
}

async function getAttendanceOverride(loginCode) {
  const normalizedLoginCode = clean(loginCode).toUpperCase();
  if (!normalizedLoginCode) return null;

  const overrides = await fetchAttendanceOverridesByLoginCodes([normalizedLoginCode]);
  return overrides.get(normalizedLoginCode) || null;
}

async function saveAttendanceOverride(loginCode, attendance) {
  const updatedAt = new Date().toISOString();

  if (supabase) {
    const { error } = await supabase
      .from("staff_attendance_overrides")
      .upsert(
        {
          login_code: loginCode,
          attendance,
          updated_at: updatedAt,
        },
        {
          onConflict: "login_code",
        }
      );

    if (!error) {
      clearAttendanceCache();
      return {
        attendance,
        updatedAt,
      };
    }

    console.warn("[WARN] Failed to save attendance to Supabase:", error.message);

    if (IS_VERCEL) {
      throw new Error("SUPABASE_WRITE_FAILED");
    }
  }

  if (IS_VERCEL) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const attendanceOverrides = loadAttendanceOverrides();

  attendanceOverrides[loginCode] = {
    attendance,
    updatedAt,
  };

  saveAttendanceOverrides(attendanceOverrides);

  clearAttendanceCache();

  return {
    attendance,
    updatedAt,
  };
}

async function getStaffForPwa(companyCode, staffNo) {
  const loginCode = makeStaffLoginCode(companyCode, staffNo);
  const staffGroups = getStaffGroups();

  const staff = staffGroups.find((x) => {
    return String(x.id || "").toUpperCase() === loginCode;
  });

  if (!staff) return null;

  const override = await getAttendanceOverride(loginCode);

  const seating = getCachedSeating();

  const familyNameKeys = (staff.familyMembers || []).map((member) =>
    normalizePersonKey(member.name)
  );

  const staffNameKey = normalizePersonKey(staff.staffName);

  const matchedSeats = seating.seats.filter((seat) => {
    const seatNameKey = normalizePersonKey(seat.name);

    return seatNameKey === staffNameKey || familyNameKeys.includes(seatNameKey);
  });

  const primarySeat = matchedSeats[0];

  return {
    ...staff,
    loginCode,
    attendance: override?.attendance || staff.attendance || "Belum daftar",
    attendanceUpdatedAt: override?.updatedAt || "",
    tableNo: staff.tableNo || "Belum ditetapkan",
    seatNo: primarySeat?.seatNo || "",
    seats: matchedSeats,
  };
}

app.post("/api/staff-login", async (req, res) => {
  const requestedGroup = clean(req.body.companyCode).toUpperCase();
  const staffNo = normalizeLoginGroupStaffNo(requestedGroup, req.body.staffNo);

  if (!["SCS", "SES", "DV", "TRAINEE"].includes(requestedGroup)) {
    return res.status(400).json({
      success: false,
      message: "Sila pilih SCS, SES, DV atau Trainee.",
    });
  }

  if (!staffNo) {
    return res.status(400).json({
      success: false,
      message: "Sila masukkan Staff No.",
    });
  }

  const lookupCompanyCode = resolveLoginCompanyCode(requestedGroup);
  const specialLinkedLogin = resolveSpecialLinkedFamilyLogin(lookupCompanyCode, staffNo);

  const householdCompanyCode =
    specialLinkedLogin?.householdCompanyCode || lookupCompanyCode;
  const householdStaffNo = specialLinkedLogin?.householdStaffNo || staffNo;

  const staff = await getStaffForPwa(householdCompanyCode, householdStaffNo);

  if (!staff) {
    return res.status(404).json({
      success: false,
      message: `Staff tidak dijumpai untuk ${requestedGroup}-${staffNo}.`,
    });
  }

  const directLoginIdentity = {
    name: staff.staffName,
    relation: "Staff",
    displayLoginGroup: requestedGroup,
    displayStaffNo: staffNo,
  };

  return res.json({
    success: true,
    data: {
      ...staff,
      // Keep the canonical household owner for attendance, telematch, seating
      // and push notification ownership. Only the login identity changes.
      loginGroup: requestedGroup,
      loginIdentity: specialLinkedLogin
        ? {
            name: specialLinkedLogin.loginPersonName,
            relation: specialLinkedLogin.loginPersonRelation,
            displayLoginGroup: specialLinkedLogin.displayLoginGroup,
            displayStaffNo: specialLinkedLogin.displayStaffNo,
          }
        : directLoginIdentity,
    },
  });
});

app.get("/api/staff/:companyCode/:staffNo", async (req, res) => {
  const companyCode = clean(req.params.companyCode).toUpperCase();
  const staffNo = normalizeStaffNo(req.params.staffNo);

  const staff = await getStaffForPwa(companyCode, staffNo);

  if (!staff) {
    return res.status(404).json({
      success: false,
      message: "Staff tidak dijumpai.",
    });
  }

  return res.json({
    success: true,
    data: staff,
  });
});

app.post("/api/staff/:companyCode/:staffNo/attendance", async (req, res) => {
  const companyCode = clean(req.params.companyCode).toUpperCase();
  const staffNo = normalizeStaffNo(req.params.staffNo);
  const attendance = clean(req.body.attendance);

  if (!["Hadir", "Tidak Hadir"].includes(attendance)) {
    return res.status(400).json({
      success: false,
      message: "Status kehadiran tidak sah.",
    });
  }

  const staff = await getStaffForPwa(companyCode, staffNo);

  if (!staff) {
    return res.status(404).json({
      success: false,
      message: "Staff tidak dijumpai.",
    });
  }

  const loginCode = makeStaffLoginCode(companyCode, staffNo);

  try {
    await saveAttendanceOverride(loginCode, attendance);
  } catch (error) {
    if (error.message === "SUPABASE_NOT_CONFIGURED") {
      return res.status(500).json({
        success: false,
        message:
          "Supabase belum dikonfigurasi di server. Sila set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.",
      });
    }

    if (
      error.message === "SUPABASE_WRITE_FAILED" ||
      error.message === "SUPABASE_READ_FAILED"
    ) {
      return res.status(500).json({
        success: false,
        message:
          "Gagal simpan ke Supabase. Sila semak nama table, schema, key, dan Vercel env vars.",
      });
    }

    throw error;
  }

  const updatedStaff = await getStaffForPwa(companyCode, staffNo);

  return res.json({
    success: true,
    message: "Kehadiran berjaya dikemaskini.",
    data: updatedStaff,
  });
});

// -----------------------------
// Push subscription endpoints
// -----------------------------

const pushSubscriptionsFile = path.join(__dirname, "data", "push_subscriptions.json");

function readLocalPushSubs() {
  try {
    if (!fs.existsSync(pushSubscriptionsFile)) return [];
    const raw = fs.readFileSync(pushSubscriptionsFile, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.warn("[PUSH] Failed to read local subscriptions:", err.message);
    return [];
  }
}

function writeLocalPushSubs(list) {
  try {
    fs.mkdirSync(path.dirname(pushSubscriptionsFile), { recursive: true });
    fs.writeFileSync(pushSubscriptionsFile, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    console.warn("[PUSH] Failed to write local subscriptions:", err.message);
  }
}

app.post("/api/push/subscribe", async (req, res) => {
  const { subscription, staff_id, device_type } = req.body || {};

  // Device type detection from user-agent (if not provided)
  let detectedDeviceType = device_type;
  if (!detectedDeviceType && req.headers['user-agent']) {
    const ua = req.headers['user-agent'].toLowerCase();
    if (ua.includes('android')) detectedDeviceType = 'Android';
    else if (ua.includes('iphone')) detectedDeviceType = 'iPhone';
    else if (ua.includes('ipad')) detectedDeviceType = 'iPad';
    else if (ua.includes('windows')) detectedDeviceType = 'Windows';
    else if (ua.includes('mac')) detectedDeviceType = 'Mac';
    else if (ua.includes('linux')) detectedDeviceType = 'Linux';
    else detectedDeviceType = 'Other';
  }

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ success: false, message: "Missing subscription object." });
  }

  try {
    if (supabase) {
      const insertRow = { staff_id: clean(staff_id), subscription, device_type: detectedDeviceType };
      const { data, error } = await supabase.from("push_subscriptions").insert([insertRow]);
      if (error) throw error;
      return res.json({ success: true, message: "Subscription saved.", data: data && data[0] });
    }

    // fallback: save to local file
    const list = readLocalPushSubs();
    list.push({ id: Date.now(), staff_id: clean(staff_id), subscription, device_type: detectedDeviceType });
    writeLocalPushSubs(list);
    return res.json({ success: true, message: "Subscription saved (local)." });
  } catch (err) {
    console.error("[PUSH] subscribe failed:", err.message || err);
    return res.status(500).json({ success: false, message: "Failed to save subscription." });
  }
});

app.get("/api/push/vapid-public", (req, res) => {
  if (!VAPID_PUBLIC_KEY) return res.status(404).json({ success: false, message: "VAPID not configured." });
  return res.json({ publicKey: VAPID_PUBLIC_KEY });
});

async function fetchSubscriptionsForAudience(audience, opts = {}) {
  if (audience === "telematch") {
    // opts may include game_ids to filter registrations
    const gameIds = Array.isArray(opts.game_ids) ? opts.game_ids : null;
    try {
      const registrationRows = await getTelematchRegistrationRows(gameIds);
      const participantIds = registrationRows.map((r) => r.participant_id);
      const participants = await getTelematchParticipantsByIds(participantIds);
      const ownerCodes = participants.map((p) => clean(p.owner_login_code)).filter(Boolean);

      if (supabase) {
        const { data, error } = await supabase
          .from("push_subscriptions")
          .select("id,staff_id,subscription")
          .in("staff_id", ownerCodes);
        if (error) throw error;
        return data || [];
      }

      const local = readLocalPushSubs();
      return local.filter((s) => ownerCodes.includes(s.staff_id));
    } catch (err) {
      console.warn("[PUSH] failed fetch telematch subs:", err.message || err);
      return [];
    }
  }

  if (["main_ajk", "sub_ajk", "all_ajk"].includes(audience)) {
    const requiredRole =
      audience === "main_ajk"
        ? "MAIN_AJK"
        : audience === "sub_ajk"
          ? "SUB_AJK"
          : null;

    const staffGroups = getStaffGroups();
    const ownerCodes = staffGroups
      .filter((staff) => {
        const staffMatches =
          !!staff.isCommittee && (requiredRole ? staff.committeeRole === requiredRole : true);

        const familyMatches = (staff.familyMembers || []).some((member) =>
          !!member.isCommittee && (requiredRole ? member.committeeRole === requiredRole : true)
        );

        // Special household cases (for example an AJK spouse) use the owning
        // staff login for push delivery, but retain the spouse's own AJK role.
        return staffMatches || familyMatches;
      })
      .map((staff) => makeStaffLoginCode(staff.companyCode, staff.staffNo))
      .filter(Boolean);

    if (!ownerCodes.length) return [];

    if (supabase) {
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id,staff_id,subscription")
        .in("staff_id", ownerCodes);
      if (error) throw error;
      return data || [];
    }

    const ownerCodeSet = new Set(ownerCodes.map((code) => clean(code).toUpperCase()));
    return readLocalPushSubs().filter((s) =>
      ownerCodeSet.has(clean(s.staff_id).toUpperCase())
    );
  }

  // default: all
  if (supabase) {
    const { data, error } = await supabase.from("push_subscriptions").select("id,staff_id,subscription");
    if (error) throw error;
    return data || [];
  }

  return readLocalPushSubs();
}

app.post("/api/push/notify", async (req, res) => {
  const { title, body, audience = "all", options = {} } = req.body || {};

  if (!title && !body) {
    return res.status(400).json({ success: false, message: "Missing title/body." });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(500).json({ success: false, message: "VAPID not configured on server." });
  }

  try {
    const subs = await fetchSubscriptionsForAudience(audience, options);
    const payload = JSON.stringify({ title: clean(title), body: clean(body), url: options.url || "/" });
    const results = [];

    for (const s of subs) {
      const subscription = s.subscription || s;
      try {
        await webpush.sendNotification(subscription, payload);
        results.push({ id: s.id || null, status: "ok" });
      } catch (err) {
        const status = (err && err.statusCode) || "error";
        results.push({ id: s.id || null, status, message: err.message });
        // cleanup if gone
        if (status === 410 || status === 404) {
          try {
            if (supabase && s.id) {
              await supabase.from("push_subscriptions").delete().match({ id: s.id });
            } else {
              const list = readLocalPushSubs().filter((x) => (x.id || x.subscription?.endpoint) !== (s.id || subscription.endpoint));
              writeLocalPushSubs(list);
            }
          } catch (cleanupErr) {
            console.warn("[PUSH] cleanup failed:", cleanupErr.message || cleanupErr);
          }
        }
      }
    }

    // Save notification to Supabase history
    await saveNotificationHistory({
      title: clean(title),
      body: clean(body),
      audience: clean(audience),
      sentAt: new Date().toISOString(),
      resultCount: results.length
    });
    return res.json({ success: true, message: "Notifications processed.", results, count: results.length });
  } catch (err) {
    console.error("[PUSH] notify failed:", err.message || err);
    return res.status(500).json({ success: false, message: "Failed to send notifications." });
  }
});

// API: Get notification history
app.get("/api/push/notification-history", (req, res) => {
  getNotificationHistory()
    .then((history) => res.json({ success: true, data: history }))
    .catch((err) => res.status(500).json({ success: false, message: "Failed to read notification history.", error: String(err) }));
});

// Helper: list saved subscriptions (local or Supabase)
app.get('/api/push/subscriptions', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase.from('push_subscriptions').select('id,staff_id,subscription,created_at,device_type');
      if (error) throw error;
      return res.json({ success: true, data: data || [] });
    }

    const list = readLocalPushSubs();
    return res.json({ success: true, data: list });
  } catch (err) {
    console.error('[PUSH] list subs failed:', err.message || err);
    return res.status(500).json({ success: false, message: 'Failed to list subscriptions.' });
  }
});

// Helper: send a test push to the first saved subscription
app.post('/api/push/send-first-test', async (req, res) => {
  const { title = 'Test', body = 'This is a test notification.' } = req.body || {};

  try {
    const subs = await fetchSubscriptionsForAudience('all');
    if (!subs || subs.length === 0) return res.status(404).json({ success: false, message: 'No subscriptions found.' });

    const target = subs[0];
    const subscription = target.subscription || target;

    const payload = JSON.stringify({ title, body, url: '/' });

    await webpush.sendNotification(subscription, payload);

    return res.json({ success: true, message: 'Test push sent.' });
  } catch (err) {
    console.error('[PUSH] send-first-test failed:', err && err.body ? err.body : err.message || err);
    return res.status(500).json({ success: false, message: 'Failed to send test push.' });
  }
});



if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Family Day Admin API running at http://localhost:${PORT}`);
    // Warm up Excel cache in background so first user request is instant
    setImmediate(() => {
      try {
        console.log("[CACHE] Warming up Excel cache on startup...");
        const t = Date.now();
        getStaffGroups();
        getCachedSeating();
        getCachedLongService();
        console.log(`[CACHE] Warm-up done in ${Date.now() - t}ms.`);
      } catch (err) {
        console.warn("[CACHE] Warm-up failed:", err.message);
      }
    });
  });
}

module.exports = app;