import React, { useEffect, useMemo, useState } from "react";
import "./staff-style.css";

const API_URL = import.meta.env.VITE_API_URL != null
  ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
  : import.meta.env.PROD
    ? ""
    : `http://${window.location.hostname}:5050`;

const tabs = [
  { key: "home", label: "Home", icon: "home" },
  { key: "program", label: "Aturcara", icon: "calendar" },
  { key: "telematch", label: "Telematch", icon: "trophy" },
  { key: "karaoke", label: "Karaoke", icon: "mic" },
  { key: "info", label: "Info", icon: "pin" },
  { key: "profile", label: "Profil", icon: "user" },
];


const KARAOKE_MP3_PATH = "/audio/karaoke-theme.mp3";
const KARAOKE_STATE_EVENT = "familyday-karaoke-state";

function getKaraokeRuntime() {
  if (typeof window === "undefined") {
    return {
      isPlaying: false,
      mode: "ready",
      audio: null,
      audioCtx: null,
      intervalId: null,
    };
  }

  if (!window.__familyDayKaraokeRuntime) {
    window.__familyDayKaraokeRuntime = {
      isPlaying: false,
      mode: "ready",
      audio: null,
      audioCtx: null,
      intervalId: null,
    };
  }

  return window.__familyDayKaraokeRuntime;
}

function emitKaraokeState() {
  if (typeof window === "undefined") return;
  const runtime = getKaraokeRuntime();

  window.dispatchEvent(
    new CustomEvent(KARAOKE_STATE_EVENT, {
      detail: {
        isPlaying: Boolean(runtime.isPlaying),
        mode: runtime.mode || "ready",
      },
    }),
  );
}

function stopKaraokeSynthRuntime(runtime) {
  if (runtime.intervalId) {
    window.clearInterval(runtime.intervalId);
    runtime.intervalId = null;
  }

  if (runtime.audioCtx) {
    runtime.audioCtx.close().catch(() => {});
    runtime.audioCtx = null;
  }
}

function stopFamilyDayKaraokeMusic() {
  if (typeof window === "undefined") return;

  const runtime = getKaraokeRuntime();
  stopKaraokeSynthRuntime(runtime);

  if (runtime.audio) {
    runtime.audio.pause();
    runtime.audio.currentTime = 0;
  }

  runtime.isPlaying = false;
  runtime.mode = "ready";
  emitKaraokeState();
}

async function startFamilyDayKaraokeFallback(runtime) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return false;

  stopKaraokeSynthRuntime(runtime);

  const ctx = new AudioContextClass();
  await ctx.resume();
  runtime.audioCtx = ctx;

  const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 659.25, 523.25];
  let index = 0;

  const playTone = () => {
    if (!runtime.audioCtx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = index % 3 === 0 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(notes[index % notes.length], now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.28);

    index += 1;
  };

  playTone();
  runtime.intervalId = window.setInterval(playTone, 340);
  runtime.isPlaying = true;
  runtime.mode = "fallback";
  emitKaraokeState();
  return true;
}

async function startFamilyDayKaraokeMusic() {
  if (typeof window === "undefined") return false;

  const runtime = getKaraokeRuntime();

  if (runtime.isPlaying) {
    emitKaraokeState();
    return true;
  }

  try {
    if (!runtime.audio) {
      const audio = new Audio(KARAOKE_MP3_PATH);
      audio.loop = true;
      audio.preload = "auto";
      runtime.audio = audio;
    }

    stopKaraokeSynthRuntime(runtime);

    try {
      await runtime.audio.play();
      runtime.isPlaying = true;
      runtime.mode = "mp3";
      emitKaraokeState();
      return true;
    } catch (mp3Error) {
      console.warn("MP3 playback unavailable, using fallback melody.", mp3Error);
    }

    return await startFamilyDayKaraokeFallback(runtime);
  } catch (error) {
    console.warn("Unable to start karaoke music:", error);
    stopFamilyDayKaraokeMusic();
    return false;
  }
}

const dinner1Program = [
  { time: "07:00 PM", title: "Ketibaan Tetamu" },
  { time: "07:30 PM", title: "Makan Malam" },
  { time: "08:30 PM", title: "Sesi Karaoke" },
  { time: "09:30 PM", title: "Penyampaian Hadiah" },
  { time: "10:00 PM", title: "Bersurai" },
];

const dinner2Program = [
  { time: "07:00 PM", title: "Ketibaan Tetamu" },
  { time: "07:30 PM", title: "Persembahan Istimewa" },
  { time: "08:00 PM", title: "Makan Malam" },
  { time: "08:45 PM", title: "Cabutan Bertuah" },
  { time: "09:30 PM", title: "Sesi Bergambar" },
  { time: "10:00 PM", title: "Bersurai" },
];

const karaokeSessions = [
  {
    time: "08:30 PM",
    title: "Open Mic Karaoke",
    location: "Dewan Utama",
    note: "Jom naik pentas dan nyanyi lagu kegemaran anda.",
  },
  {
    time: "09:00 PM",
    title: "Family Karaoke",
    location: "Dewan Utama",
    note: "Persembahan santai bersama pasangan atau anak-anak.",
  },
  {
    time: "09:20 PM",
    title: "Lucky Song Challenge",
    location: "Dewan Utama",
    note: "Cabaran lagu spontan dengan hadiah misteri.",
  },
];

const karaokePunchlines = [
  "Tak perlu suara power… yang penting confident naik stage! 🎤🔥",
  "Pitch lari sikit tak apa… janji semangat jangan lari! 😂🎶",
  "Nyanyi dulu, malu kemudian! 😎🎤",
  "Suara biasa-biasa, gaya mesti luar biasa! ✨🎶",
  "Kalau lupa lirik… senyum dan teruskan! 😂🎵",
  "Mic dah panas… siapa berani, dia jadi bintang! ⭐🎤",
  "Nak bunga tak? Nyanyi dulu! 🌸🎤",
  "Kenapa sedih ni… meh karok dulu 🫣🎶",
  "Kenapa nak malu? Suara kita memang sedap kan? 😂🎤",
  "Jangan fikir sangat… dulu ajak pergi kelas vokal tak nak 😜🎵",
];

const telematchGames = [
  {
    name: "Baling Tin",
    time: "10:00 AM - 10:30 AM",
    location: "Padang A",
    status: "Sedang",
  },
  {
    name: "Tarik Tali",
    time: "10:45 AM - 11:15 AM",
    location: "Padang B",
    status: "Akan Datang",
  },
  {
    name: "Lari Dalam Guni",
    time: "11:30 AM - 12:00 PM",
    location: "Padang A",
    status: "Akan Datang",
  },
  {
    name: "Boling Padang",
    time: "02:00 PM - 02:30 PM",
    location: "Dewan",
    status: "Akan Datang",
  },
];


const kidTelematchRules = [
  {
    id: "kid-opening",
    number: "OPEN",
    shortTitle: "Cari Barang",
    title: "Cari Barang Tersembunyi",
    age: "3 - 7 Years",
    accent: "aqua",
    description: "Pemain perlu mencari gula-gula / coklat di dalam tempat yang disediakan.",
    win: "Opening Game untuk kanak-kanak berumur 3 hingga 7 tahun.",
    steps: [
      "Dengar arahan fasilitator sebelum permainan bermula.",
      "Cari gula-gula / coklat di kawasan yang telah disediakan.",
      "Ikut arahan keselamatan dan sempadan kawasan permainan."
    ]
  },
  {
    id: "kid-1",
    number: "01",
    shortTitle: "Pindah Air",
    title: "Pindah Air Guna Span",
    age: "4 - 8 Years",
    accent: "aqua",
    description: "Peserta mencelup span ke dalam bekas berisi air, memindahkannya, kemudian memerah air ke dalam bekas kosong.",
    win: "Pasukan yang paling cepat memenuhi botol / bekas air dikira pemenang.",
    steps: [
      "Celup span ke dalam bekas berisi air.",
      "Bawa span ke bekas atau botol kosong pasukan.",
      "Perah air daripada span ke dalam bekas kosong.",
      "Ulang langkah sehingga bekas penuh."
    ]
  },
  {
    id: "kid-2",
    number: "02",
    shortTitle: "Mumia Wrap",
    title: "Mumia Wrap",
    age: "4 - 12 Years",
    accent: "sunset",
    description: "Setiap kumpulan perlu membalut seorang ahli kumpulan menggunakan tisu tandas sehingga menjadi mumia.",
    win: "Balutan paling pantas dan paling kemas dikira menang.",
    steps: [
      "Pilih seorang ahli kumpulan sebagai 'mumia'.",
      "Balut peserta menggunakan tisu tandas.",
      "Pastikan balutan menutupi badan sebanyak mungkin.",
      "Kumpulan terpantas dan paling kemas dikira pemenang."
    ]
  },
  {
    id: "kid-3",
    number: "03",
    shortTitle: "Berbaris",
    title: "Berbaris Mengikut Arahan",
    age: "4 - 12 Years",
    accent: "berry",
    description: "Fasilitator memberikan arahan fizikal secara rawak dan peserta perlu berbaris atau bergerak mengikut arahan tersebut.",
    win: "Kumpulan dengan peserta paling ramai yang kekal bertahan dikira pemenang.",
    steps: [
      "Dengar arahan fasilitator dengan teliti.",
      "Ikut arahan seperti angkat tangan kanan, lompat dua kali atau pusing ke kiri.",
      "Peserta yang tersalah langkah boleh tersingkir.",
      "Kumpulan yang paling ramai bertahan menang."
    ]
  },
  {
    id: "kid-4",
    number: "04",
    shortTitle: "Tarik Tali",
    title: "Tarik Tali Mini",
    age: "7 - 12 Years",
    accent: "lime",
    description: "Peserta dibahagikan kepada 4 kumpulan dan bertanding tarik tali secara mini mengikut perlawanan yang ditetapkan.",
    win: "Pemenang setiap perlawanan akan mara ke final untuk menentukan juara.",
    steps: [
      "Bahagikan peserta kepada 4 kumpulan.",
      "Contoh perlawanan: rumah merah vs rumah hijau dan rumah kuning vs rumah biru.",
      "Pemenang setiap perlawanan mara ke final.",
      "Pasukan yang menang final dikira juara."
    ]
  }
];

const adultTelematchRules = [
  {
    id: "adult-1",
    number: "01",
    shortTitle: "Belon & Ping Pong",
    title: "Lari Kepit Belon & Bawa Bola Ping Pong Dalam Sudu",
    age: "Adult",
    accent: "aqua",
    description: "Setiap peserta perlu mengepit belon dan membawa bola ping pong di dalam sudu sehingga ke garisan penamat.",
    win: "Jika belon atau bola ping pong jatuh, peserta perlu ulang dari garisan permulaan. Kumpulan yang habis awal dikira pemenang.",
    steps: [
      "Kepit belon dengan kemas semasa bergerak.",
      "Bawa bola ping pong menggunakan sudu hingga ke penamat.",
      "Jika belon atau bola ping pong jatuh, peserta perlu ulang semula dari mula.",
      "Pasukan yang tamat paling awal dikira menang."
    ]
  },
  {
    id: "adult-2",
    number: "02",
    shortTitle: "4 x 50m",
    title: "4 x 50m Lari Berganti-Ganti",
    age: "Adult",
    accent: "sunset",
    description: "Peserta perlu berlari secara berganti-ganti bersama ahli pasukan yang sama sehingga semua giliran selesai.",
    win: "Pasukan yang berjaya menamatkan larian paling awal dikira pemenang.",
    steps: [
      "Susun peserta mengikut giliran larian.",
      "Peserta pertama mula berlari ke checkpoint atau penamat sementara.",
      "Sambung giliran kepada ahli pasukan seterusnya.",
      "Pasukan terpantas menamatkan semua pusingan menang."
    ]
  },
  {
    id: "adult-3",
    number: "03",
    shortTitle: "Dadu Makan Tuan",
    title: "Dadu Makan Tuan",
    age: "Adult",
    accent: "berry",
    description: "Peserta hadapan membaling dadu dan bergerak ke hadapan atau ke belakang mengikut nombor yang diperoleh.",
    win: "Pasukan yang sampai ke garisan penamat terlebih dahulu dikira pemenang.",
    steps: [
      "Peserta hadapan baling dadu.",
      "Jika nombor positif, pasukan bergerak ke hadapan ikut bilangan pada dadu.",
      "Jika nombor negatif / arahan khas, pasukan perlu bergerak ke belakang.",
      "Pasukan pertama sampai ke penamat dikira menang."
    ]
  },
  {
    id: "adult-4",
    number: "04",
    shortTitle: "Bola Pelikat",
    title: "Bola Pelikat",
    age: "Adult",
    accent: "lime",
    description: "Peserta dibahagikan kepada 4 kumpulan dan bertanding mengikut pasangan rumah sebelum mara ke final.",
    win: "Pemenang setiap perlawanan mara ke final. Setiap permainan diberi masa 5 minit.",
    steps: [
      "Bahagikan peserta kepada 4 kumpulan.",
      "Contoh: rumah merah vs rumah hijau, rumah kuning vs rumah biru.",
      "Setiap pasukan menghantar 4 lelaki dan 4 perempuan.",
      "Pemenang perlawanan awal mara ke final untuk menentukan juara."
    ]
  }
];

function AppIcon({ name, size = 20, className = "" }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: `app-icon ${className}`.trim(),
    "aria-hidden": "true",
  };

  const icons = {
    home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
    trophy: <><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4M12 12v5M8.5 21h7M10 17h4"/></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 10a6 6 0 0 0 12 0M12 16v5M9 21h6"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
    bed: <><path d="M3 19v-8M21 19v-6a3 3 0 0 0-3-3H9a3 3 0 0 0-3 3v3M3 16h18"/><path d="M6 10V7h5a2 2 0 0 1 2 2v1"/></>,
    table: <><path d="M4 8h16M6 8v12M18 8v12"/><rect x="3" y="4" width="18" height="4" rx="2"/></>,
    family: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M13 20a4 4 0 0 1 8 0"/></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>,
    award: <><circle cx="12" cy="9" r="5"/><path d="m9 14-2 7 5-3 5 3-2-7"/></>,
    building: <><path d="M4 21V4h11v17M15 9h5v12M8 8h3M8 12h3M8 16h3M18 13h.01M18 17h.01"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    seat: <><path d="M7 5v8h10V5M5 13h14v5H5zM7 18v3M17 18v3"/></>,
    phone: <><path d="M6.5 3h3l1.5 4-2 1.5a15 15 0 0 0 6.5 6.5L17 13l4 1.5v3a3 3 0 0 1-3 3C10 20.5 3.5 14 3.5 6a3 3 0 0 1 3-3Z"/></>,
    music: <><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
    document: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>,
    arrowLeft: <><path d="m15 18-6-6 6-6"/><path d="M9 12h10"/></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/></>,
    sparkle: <><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m18.5 15 .7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z"/></>,
  };

  return <svg {...common}>{icons[name] || icons.sparkle}</svg>;
}

function getHouseMeta(team) {
  const value = String(team || "").toLowerCase();

  if (value.includes("blue sharks") || value.includes("shark")) {
    return { label: "BLUE SHARKS", className: "house-blue", imageUrl: "/house-images/BLUE%20SHARKS.png" };
  }

  if (value.includes("red lions") || value.includes("lion")) {
    return { label: "RED LIONS", className: "house-red", imageUrl: "/house-images/RED%20LIONS.png" };
  }

  if (value.includes("green lynx") || value.includes("lynx")) {
    return { label: "GREEN LYNX", className: "house-green", imageUrl: "/house-images/GREEN%20LYNX.png" };
  }

  if (value.includes("lilac wolves") || value.includes("wolf") || value.includes("lilac")) {
    return { label: "LILAC WOLVES", className: "house-lilac", imageUrl: "/house-images/LILAC%20WOLVES.png" };
  }

  if (value.includes("merah")) {
    return { label: "Rumah Merah", className: "house-red" };
  }

  if (value.includes("hijau")) {
    return { label: "Rumah Hijau", className: "house-green" };
  }

  if (value.includes("kuning")) {
    return { label: "Rumah Kuning", className: "house-yellow" };
  }

  if (value.includes("biru")) {
    return { label: "Rumah Biru", className: "house-blue" };
  }

  return { label: "Belum ditetapkan", className: "house-default" };
}

function houseToTeamColor(houseName) {
  const value = String(houseName || "").toLowerCase();

  if (value.includes("blue sharks") || value.includes("shark")) return "Blue";
  if (value.includes("red lions") || value.includes("lion")) return "Red";
  if (value.includes("green lynx") || value.includes("lynx")) return "Green";
  // Existing Supabase telematch schema supports Green/Yellow/Red/Blue only.
  // Keep LILAC WOLVES visually lilac, but use Yellow for registration compatibility.
  if (value.includes("lilac wolves") || value.includes("wolf") || value.includes("lilac")) return "Yellow";

  if (value.includes("merah")) return "Red";
  if (value.includes("hijau")) return "Green";
  if (value.includes("kuning")) return "Yellow";
  if (value.includes("biru")) return "Blue";

  return "Green";
}

function formatTeamColor(teamColor) {
  const value = String(teamColor || "").toLowerCase();

  if (value === "green") return "Hijau";
  if (value === "yellow") return "Kuning";
  if (value === "red") return "Merah";
  if (value === "blue") return "Biru";

  return teamColor || "Hijau";
}

function formatParticipantHouseColor(teamName, teamColor) {
  const houseValue = String(teamName || "").toLowerCase();

  if (houseValue.includes("lilac wolves") || houseValue.includes("lilac") || houseValue.includes("wolf")) {
    return "Lilac";
  }

  return formatTeamColor(teamColor);
}

function normalizeMemberCategory(category, age) {
  const numericAge = Number(age || 0);
  const value = String(category || "").toLowerCase();

  // Family Day 2026 participant category:
  // Family members aged 1 - 12 are Kid.
  // Game eligibility is handled separately by the Kid game's age rule.
  // Example: a 3-year-old remains Kid, but sees no game if every game starts at age 4.
  if (Number.isFinite(numericAge) && numericAge > 0) {
    return numericAge <= 12 ? "Kid" : "Adult";
  }

  // Fallback only when age is unavailable.
  if (value.includes("kid") || value.includes("kanak") || value.includes("child")) {
    return "Kid";
  }

  return "Adult";
}

function formatGameTimeRange(game) {
  const startTime = String(game?.startTime || "").trim();
  const endTime = String(game?.endTime || "").trim();

  if (startTime && endTime) {
    return `${startTime} - ${endTime}`;
  }

  if (startTime) {
    return `Start: ${startTime}`;
  }

  if (endTime) {
    return `End: ${endTime}`;
  }

  return "Belum ditetapkan";
}

function isPresent(attendance) {
  const text = String(attendance || "").toLowerCase();

  return text.includes("hadir") && !text.includes("tidak");
}

function normalizeStaffNo(value) {
  const text = String(value || "").trim();

  if (!text) return "";

  const cleaned = text.replace(/^SCS/i, "").replace(/^SES/i, "").replace(/-/g, "").trim();

  if (/^\d+$/.test(cleaned)) {
    return cleaned.padStart(3, "0");
  }

  return cleaned;
}

function normalizeLoginStaffNo(value, group) {
  const selectedGroup = String(group || "").trim().toUpperCase();
  let normalized = normalizeStaffNo(value).toUpperCase();

  if (!normalized) return "";

  if (selectedGroup === "DV") {
    normalized = normalized.replace(/^DV/i, "");
    return `DV${normalized.replace(/^0+(?=\d)/, "").padStart(3, "0")}`;
  }

  if (selectedGroup === "TRAINEE") {
    normalized = normalized.replace(/^T/i, "");
    return `T${normalized.replace(/^0+(?=\d)/, "")}`;
  }

  return normalized;
}

function getBackendLoginCompanyCode(group) {
  const selectedGroup = String(group || "").trim().toUpperCase();
  return selectedGroup === "DV" || selectedGroup === "TRAINEE" ? "SCS" : selectedGroup;
}

function getDisplayLoginGroup(staff) {
  const loginGroup = String(staff?.loginGroup || "").trim();
  return loginGroup || staff?.companyCode || "";
}

function getDisplayStaffNo(staff) {
  const loginGroup = String(staff?.loginGroup || "").trim().toUpperCase();
  const staffNo = String(staff?.staffNo || "").trim();

  if (loginGroup === "DV") return staffNo.replace(/^DV/i, "");
  if (loginGroup === "TRAINEE") return staffNo.replace(/^T/i, "");
  return staffNo;
}

function StaffLogin({ onLogin }) {
  const [companyCode, setCompanyCode] = useState("SCS");
  const [staffNo, setStaffNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const loginGroups = ["SCS", "SES", "DV", "Trainee"];

  async function submitLogin(event) {
    event.preventDefault();

    const normalizedLoginNo = normalizeLoginStaffNo(staffNo, companyCode);

    if (!normalizedLoginNo) {
      setErrorText("Sila masukkan Staff No.");
      return;
    }

    setLoading(true);
    setErrorText("");

    try {
      const response = await fetch(`${API_URL}/api/staff-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // DV/Trainee records live in the existing SCS workbook/data source.
          // Send SCS internally so this also works with older deployed backends
          // that still validate only SCS/SES. The user's selected group is kept
          // separately in loginGroup for display/session purposes.
          companyCode: getBackendLoginCompanyCode(companyCode),
          staffNo: normalizedLoginNo,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error("Staff tidak dijumpai.\nSila semak Staff No.");
      }

      const canonicalCompanyCode = result.data?.companyCode || getBackendLoginCompanyCode(companyCode);
      const canonicalStaffNo = result.data?.staffNo || normalizedLoginNo;
      const selectedLoginGroup = String(companyCode || "").trim();
      const loginData = {
        ...result.data,
        loginGroup: selectedLoginGroup,
      };

      localStorage.setItem("familyDayStaffCompany", canonicalCompanyCode);
      localStorage.setItem("familyDayStaffNo", canonicalStaffNo);
      localStorage.setItem("familyDayStaffLoginGroup", selectedLoginGroup);
      if (result.data?.loginIdentity) {
        localStorage.setItem(
          "familyDayStaffLoginIdentity",
          JSON.stringify(result.data.loginIdentity)
        );
      } else {
        localStorage.removeItem("familyDayStaffLoginIdentity");
      }

      onLogin(loginData);
    } catch (error) {
      setErrorText(error?.message || "Staff tidak dijumpai.\nSila semak Staff No.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="staff-login-page">
      <div className="login-orb login-orb-one" aria-hidden="true" />
      <div className="login-orb login-orb-two" aria-hidden="true" />
      <div className="login-orb login-orb-three" aria-hidden="true" />

      <div className="login-confetti login-confetti-a" aria-hidden="true">✦</div>
      <div className="login-confetti login-confetti-b" aria-hidden="true">●</div>
      <div className="login-confetti login-confetti-c" aria-hidden="true">✦</div>
      <div className="login-confetti login-confetti-d" aria-hidden="true">●</div>

      <form className="login-card login-card-fun" onSubmit={submitLogin}>
        <div className="login-brand login-brand-cute" aria-label="SCS Family Day 2026">
          <div className="login-brand-decoration login-brand-decoration-sun" aria-hidden="true">☀️</div>
          <div className="login-brand-decoration login-brand-decoration-balloon" aria-hidden="true">🎈</div>
          <div className="login-brand-decoration login-brand-decoration-palm" aria-hidden="true">🌴</div>
          <div className="login-brand-decoration login-brand-decoration-wave" aria-hidden="true">🌊</div>
          <div className="login-brand-decoration login-brand-decoration-family" aria-hidden="true">👨‍👩‍👧‍👦</div>
          <div className="login-brand-decoration login-brand-decoration-star" aria-hidden="true">🎉</div>
          <div className="login-brand-kicker">SCS</div>
          <div className="login-brand-title">Family Day</div>
          <div className="login-brand-year">2026</div>
          <a className="login-brand-venue" href="https://amvertoncove.com/" target="_blank" rel="noreferrer">Amverton Cove Golf &amp; Island Resort</a>
          <div className="login-brand-tagline">Jom Santai • Main • Bergembira</div>
          <div className="login-brand-family-badge"><span aria-hidden="true">💛</span><b>Family Time</b><span aria-hidden="true">✨</span></div>
          <div className="login-brand-sparkle" aria-hidden="true">✦</div>
        </div>

        <div className="login-welcome">
          <h1>Selamat Datang! <span aria-hidden="true">👋</span></h1>
          <p>Pilih syarikat/trainee anda dan masukkan nombor staff untuk teruskan.</p>
        </div>

        <div className="login-section login-section-modern">
          <label>Syarikat / Trainee</label>
          <div className="company-toggle company-toggle-four" role="group" aria-label="Syarikat atau trainee">
            {loginGroups.map((group) => (
              <button
                key={group}
                type="button"
                className={companyCode === group ? "active" : ""}
                onClick={() => {
                  setCompanyCode(group);
                  setStaffNo("");
                  setErrorText("");
                }}
                aria-pressed={companyCode === group}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        <div className="login-section login-section-modern">
          <label htmlFor="staff-login-no">Staff No</label>
          <div className="staff-no-field">
            <span className="staff-no-icon" aria-hidden="true">#</span>
            <input
              id="staff-login-no"
              value={staffNo}
              onChange={(event) => {
                const rawValue = event.target.value;
                const nextValue = companyCode === "DV" || companyCode === "Trainee"
                  ? rawValue.replace(/\D/g, "")
                  : rawValue;
                setStaffNo(nextValue);
                if (errorText) setErrorText("");
              }}
              placeholder={companyCode === "DV" ? "Contoh : 020" : companyCode === "Trainee" ? "Contoh : 214" : "Contoh : 001"}
              inputMode="numeric"
              autoComplete="username"
              autoFocus
            />
          </div>
        </div>

        {errorText && <div className="login-error" role="alert">{errorText}</div>}

        <button className="login-btn login-btn-fun" type="submit" disabled={loading || !staffNo.trim()}>
          <span>{loading ? "Menyemak..." : "Jom Masuk"}</span>
          {!loading && <span className="login-btn-arrow" aria-hidden="true">→</span>}
        </button>

        <div className="login-footer-note">
          <span aria-hidden="true">☀️</span>
          <span>Happy Family • Happy Memories</span>
          <span aria-hidden="true">🌴</span>
        </div>
      </form>
    </div>
  );
}

function HeaderCard({ staff }) {
  const house = getHouseMeta(staff.team);
  const loginIdentity = staff?.loginIdentity || null;
  const displayName = loginIdentity?.name || staff.staffName;
  const displayRelation = loginIdentity?.relation || "Staff";
  const displayGroup = loginIdentity?.displayLoginGroup || getDisplayLoginGroup(staff);
  const displayNo = loginIdentity?.displayStaffNo || getDisplayStaffNo(staff);

  return (
    <div className={`staff-header-card ${house.className}`}>
      <div className="header-house-mark" aria-hidden="true">
        <img className="header-house-watermark header-house-watermark-glow" src={house.imageUrl} alt="" />
        <img className="header-house-watermark header-house-watermark-main" src={house.imageUrl} alt="" />
      </div>

      <div className="staff-header-copy">
        <small>Hai, selamat datang</small>
        <h1>{displayName}</h1>
        <p>
          {displayGroup}-{displayNo} · {displayRelation}
        </p>
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value, accent, watermark }) {
  return (
    <div className={`info-tile ${accent || ""}`}>
      {watermark && <img className="tile-house-watermark" src={watermark} alt="" aria-hidden="true" />}
      <span className="info-icon-badge"><AppIcon name={icon} size={21} /></span>
      <small>{label}</small>
      <strong>{value || "Belum ditetapkan"}</strong>
    </div>
  );
}

function HomePage({ staff }) {
  const house = getHouseMeta(staff.team);

  return (
    <>
      <div className="tile-grid">
        <InfoTile icon="bed" label="No. Bilik" value={staff.roomNumber || "Belum ditetapkan"} />
        <InfoTile icon="table" label="No. Meja" value={staff.tableNo} />
        <InfoTile icon="family" label="Jumlah Ahli" value={`${staff.totalFamily || 0} orang`} />
        <InfoTile icon="shield" label="Rumah" value={house.label} accent={`house ${house.className}`} watermark={house.imageUrl} />
      </div>

      {staff.isAwardRecipient && (
        <section className="award-card award-card-themed">
          <span className="award-icon-badge"><AppIcon name="award" size={22} /></span>
          <div>
            <strong>Penerima Anugerah</strong>
            <p>{staff.awardInfo?.awardTitle || "Long Service Award"}</p>
          </div>
        </section>
      )}

      {staff.isCommittee && (
        <section className={`committee-card ${staff.committeeRole === "MAIN_AJK" ? "main-ajk" : "sub-ajk"}`}>
          <span className="committee-icon-badge">★</span>
          <div>
            <strong>{staff.committeeLabel || "AJK"}</strong>
            <p>Jawatankuasa Family Day 2026</p>
          </div>
        </section>
      )}

      <section className="mobile-panel home-family-panel">
        <img className="panel-house-watermark" src={house.imageUrl} alt="" aria-hidden="true" />
        <div className="mobile-panel-header">
          <h3>Ahli Keluarga / Peserta</h3>
          <span>{staff.familyMembers?.length || 0}</span>
        </div>

        <div className="family-list">
          {(staff.familyMembers || []).map((member, index) => (
            <div key={`${member.name}-${index}`}>
              <div>
                <strong>{member.name}</strong>
                <small>{member.relation || "Family"}</small>
              </div>
              {member.isAwardRecipient && <em className="mini-award"><AppIcon name="award" size={18} /></em>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function ProgramPage() {
  const [activeDinner, setActiveDinner] = useState("dinner1");

  const isDinner1 = activeDinner === "dinner1";
  const activeProgram = isDinner1 ? dinner1Program : dinner2Program;

  return (
    <>
      <div className="program-tabs" role="tablist" aria-label="Pilih aturcara malam">
        <button
          type="button"
          role="tab"
          aria-selected={isDinner1}
          className={isDinner1 ? "active dinner1" : "dinner1"}
          onClick={() => setActiveDinner("dinner1")}
        >
          <span>Malam 1</span>
          <small>31 Aug 2026</small>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={!isDinner1}
          className={!isDinner1 ? "active dinner2" : "dinner2"}
          onClick={() => setActiveDinner("dinner2")}
        >
          <span>Malam 2</span>
          <small>1 Sep 2026</small>
        </button>
      </div>

      <div key={activeDinner} className="program-tab-content">
        <ProgramList
          title=""
          items={activeProgram}
        />
      </div>
    </>
  );
}

function ProgramList({ title, items }) {
  return (
    <section className="mobile-panel">
      {title ? (
        <div className="mobile-panel-header">
          <h3>{title}</h3>
        </div>
      ) : null}

      <div className="program-list-mobile">
        {items.map((item) => (
          <div key={`${item.time}-${item.title}`}>
            <span>{item.time}</span>
            <strong>{item.title}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function KaraokePage({ staff }) {
  const [punchlineIndex, setPunchlineIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPunchlineIndex((current) => (current + 1) % karaokePunchlines.length);
    }, 3600);

    return () => window.clearInterval(timer);
  }, []);

  const participants = useMemo(() => {
    const list = [
      {
        key: `staff-${staff.companyCode}-${staff.staffNo}`,
        name: staff.staffName,
        relation: "Staff",
        shortLabel: staff.staffName,
      },
    ];

    (staff.familyMembers || []).forEach((member, index) => {
      if (member?.isStaff) return;

      list.push({
        key: `fam-${staff.companyCode}-${staff.staffNo}-${index}`,
        name: member.name,
        relation: member.relation || "Keluarga",
        shortLabel: member.name,
      });
    });

    return list;
  }, [staff]);

  const [selectedPersonKey, setSelectedPersonKey] = useState("");
  const [song1, setSong1] = useState("");
  const [song2, setSong2] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState("success");

  const selectedPerson = useMemo(
    () => participants.find((person) => person.key === selectedPersonKey) || null,
    [participants, selectedPersonKey],
  );

  const selectedCount = [song1, song2].filter((song) => String(song || "").trim()).length;

  useEffect(() => {
    setSong1("");
    setSong2("");
    setFeedback("");

    if (!selectedPerson) return;

    async function loadExisting() {
      try {
        const params = new URLSearchParams({
          companyCode: String(staff.companyCode || ""),
          staffNo: String(staff.staffNo || ""),
          participantKey: selectedPerson.key,
        });

        const response = await fetch(`${API_URL}/api/karaoke/registration?${params}`);
        const result = await response.json();

        if (response.ok && result.success && result.data) {
          setSong1(result.data.song1 || "");
          setSong2(result.data.song2 || "");
        }
      } catch (error) {
        console.warn("Karaoke registration load failed:", error);
      }
    }

    loadExisting();
  }, [selectedPersonKey, selectedPerson, staff.companyCode, staff.staffNo]);

  async function saveKaraokeRegistration() {
    if (!selectedPerson) {
      setFeedbackType("error");
      setFeedback("Sila pilih peserta yang akan menyanyi.");
      return;
    }

    const cleanSong1 = String(song1 || "").trim();
    const cleanSong2 = String(song2 || "").trim();

    if (!cleanSong1 && !cleanSong2) {
      setFeedbackType("error");
      setFeedback("Sila masukkan sekurang-kurangnya 1 lagu.");
      return;
    }

    setSaving(true);
    setFeedback("");

    try {
      const response = await fetch(`${API_URL}/api/karaoke/registration`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyCode: staff.companyCode,
          staffNo: staff.staffNo,
          participantKey: selectedPerson.key,
          participantName: selectedPerson.name,
          relation: selectedPerson.relation,
          song1: cleanSong1,
          song2: cleanSong2,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal simpan pendaftaran karaoke.");
      }

      setFeedbackType("success");
      setFeedback(`Pendaftaran karaoke berjaya disimpan untuk ${selectedPerson.name}.`);
    } catch (error) {
      setFeedbackType("error");
      setFeedback(error.message || "Gagal simpan pendaftaran karaoke.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="karaoke-registration-page">
      <div className="karaoke-registration-fx" aria-hidden="true">
        <span className="karaoke-reg-note note-1">♪</span>
        <span className="karaoke-reg-note note-2">♫</span>
        <span className="karaoke-reg-note note-3">♬</span>
        <span className="karaoke-reg-note note-4">♪</span>
        <span className="karaoke-reg-light light-1" />
        <span className="karaoke-reg-light light-2" />
      </div>

      <section className="mobile-panel karaoke-terms-card">
        <div className="karaoke-terms-head">
          <span className="karaoke-terms-mic"><AppIcon name="mic" size={20} /></span>
          <div>
            <small>Karaoke Challenge</small>
            <h3>Mic Dah Panas! 🔥</h3>
          </div>
          <span className="karaoke-slot-badge">
            <b>10</b>
            <small>Slot</small>
          </span>
        </div>

        <div className="karaoke-terms-list">
          <div>
            <span>🎵</span>
            <p>Setiap peserta <b>WAJIB daftar 2 lagu</b>.</p>
          </div>
          <div>
            <span>⚡</span>
            <p>Karaoke Session hanya ada <b>10 slot sahaja</b>.</p>
          </div>
          <div>
            <span>🏃</span>
            <p>Konsep dia mudah: <b>Siapa Cepat, Dia Dapat! 😎</b></p>
          </div>
          <div>
            <span>😂</span>
            <p>Bila 10 slot penuh… <b>mic tutup kedai bro!</b></p>
          </div>
        </div>

        <div className="karaoke-terms-punchline" aria-live="polite">
          <span key={punchlineIndex} className="karaoke-punchline-text">
            “{karaokePunchlines[punchlineIndex]}”
          </span>
          <span className="karaoke-punchline-dots" aria-hidden="true">
            {karaokePunchlines.map((_, index) => (
              <i key={index} className={index === punchlineIndex ? "active" : ""} />
            ))}
          </span>
        </div>
      </section>

      <section className="mobile-panel karaoke-registration-panel">
        <div className="mobile-panel-header">
          <h3>Pilih Penyanyi</h3>
          <span>{participants.length}</span>
        </div>

        <div className="karaoke-participant-picker">
          {participants.map((person) => {
            const active = person.key === selectedPersonKey;
            return (
              <button
                type="button"
                key={person.key}
                className={active ? "karaoke-person active" : "karaoke-person"}
                onClick={() => setSelectedPersonKey(person.key)}
              >
                <span className="karaoke-person-icon"><AppIcon name="mic" size={18} /></span>
                <div>
                  <strong>{person.shortLabel}</strong>
                  <small>{person.relation}</small>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mobile-panel karaoke-registration-panel">
        <div className="mobile-panel-header">
          <h3>Pilihan Lagu</h3>
          <span>{selectedCount}/2</span>
        </div>

        <div className="karaoke-song-fields">
          <label>
            <span>Lagu 1</span>
            <input
              type="text"
              value={song1}
              onChange={(event) => setSong1(event.target.value)}
              placeholder="Contoh: Tulus - Teh Hijau"
              disabled={!selectedPerson || saving}
              maxLength={120}
            />
          </label>

          <label>
            <span>Lagu 2</span>
            <input
              type="text"
              value={song2}
              onChange={(event) => setSong2(event.target.value)}
              placeholder="Lagu kedua (pilihan)"
              disabled={!selectedPerson || saving}
              maxLength={120}
            />
          </label>
        </div>

        {selectedPerson && (
          <div className="karaoke-registration-summary">
            <span className="karaoke-person-icon"><AppIcon name="user" size={17} /></span>
            <div>
              <small>Penyanyi Dipilih</small>
              <strong>{selectedPerson.name}</strong>
              <span>{selectedPerson.relation} · {selectedCount}/2 lagu</span>
            </div>
          </div>
        )}

        {feedback && (
          <div className={`karaoke-registration-feedback ${feedbackType}`}>
            {feedback}
          </div>
        )}

        <button
          type="button"
          className="karaoke-submit-btn"
          disabled={!selectedPerson || selectedCount === 0 || saving}
          onClick={saveKaraokeRegistration}
        >
          <AppIcon name="music" size={18} />
          <span>{saving ? "Menyimpan..." : "Simpan Pendaftaran"}</span>
        </button>
      </section>
    </div>
  );
}


const kidTelematchAgeRules = [
  {
    minAge: 3,
    maxAge: 7,
    isOpeningGame: true,
    aliases: ["cari barang tersembunyi", "cari barang"],
  },
  {
    minAge: 4,
    maxAge: 8,
    aliases: ["pindah air guna span", "pindah air", "span"],
  },
  {
    minAge: 4,
    maxAge: 12,
    aliases: ["mumia wrap", "mumia"],
  },
  {
    minAge: 4,
    maxAge: 12,
    aliases: ["berbaris mengikut arahan", "berbaris", "ikut arahan"],
  },
  {
    minAge: 7,
    maxAge: 12,
    aliases: ["tarik tali mini", "tarik tali"],
  },
];

function normalizeTelematchGameName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getKidGameAgeRule(game) {
  const name = normalizeTelematchGameName(game?.name);

  if (!name) return null;

  return kidTelematchAgeRules.find((rule) =>
    rule.aliases.some((alias) => name.includes(normalizeTelematchGameName(alias)))
  ) || null;
}

function isKidOpeningGame(game) {
  return Boolean(getKidGameAgeRule(game)?.isOpeningGame);
}

function isKidEligibleForGame(game, age) {
  const numericAge = Number(age || 0);
  const rule = getKidGameAgeRule(game);

  // Strict Kid catalogue: only games with an explicit age rule are eligible.
  // This keeps Staff View consistent with backend validation.
  if (!rule) return false;

  if (!Number.isFinite(numericAge) || numericAge <= 0) return false;

  return numericAge >= rule.minAge && numericAge <= rule.maxAge;
}

const officialKidGameAliases = [
  "cari barang tersembunyi",
  "pindah air guna span",
  "mumia wrap",
  "berbaris mengikut arahan",
  "tarik tali mini",
];

const officialAdultGameAliases = [
  "lari kepit belon & bawak bola ping pong dalam sudu",
  "4 x 50m lari berganti-ganti",
  "dadu makan tuan",
  "bola pelikat",
];

const officialTelematchFallbackGames = [
  {
    id: "fallback-kid-cari-barang",
    name: "Cari Barang Tersembunyi",
    description: "Opening Game · Kid 3 - 7 tahun.",
    category: "Kid",
    location: "Padang Telematch",
    startTime: "",
    endTime: "",
    maxTeamMembers: 99,
    teamCounts: { Green: 0, Yellow: 0, Red: 0, Blue: 0 },
    isFallback: true,
  },
  {
    id: "fallback-kid-pindah-air",
    name: "Pindah Air Guna Span",
    description: "Kid 4 - 8 tahun.",
    category: "Kid",
    location: "Padang Telematch",
    startTime: "",
    endTime: "",
    maxTeamMembers: 99,
    teamCounts: { Green: 0, Yellow: 0, Red: 0, Blue: 0 },
    isFallback: true,
  },
  {
    id: "fallback-kid-mumia-wrap",
    name: "Mumia Wrap",
    description: "Kid 4 - 12 tahun.",
    category: "Kid",
    location: "Padang Telematch",
    startTime: "",
    endTime: "",
    maxTeamMembers: 99,
    teamCounts: { Green: 0, Yellow: 0, Red: 0, Blue: 0 },
    isFallback: true,
  },
  {
    id: "fallback-kid-berbaris",
    name: "Berbaris Mengikut Arahan",
    description: "Kid 4 - 12 tahun.",
    category: "Kid",
    location: "Padang Telematch",
    startTime: "",
    endTime: "",
    maxTeamMembers: 99,
    teamCounts: { Green: 0, Yellow: 0, Red: 0, Blue: 0 },
    isFallback: true,
  },
  {
    id: "fallback-kid-tarik-tali",
    name: "Tarik Tali Mini",
    description: "Kid 7 - 12 tahun.",
    category: "Kid",
    location: "Padang Telematch",
    startTime: "",
    endTime: "",
    maxTeamMembers: 99,
    teamCounts: { Green: 0, Yellow: 0, Red: 0, Blue: 0 },
    isFallback: true,
  },
  {
    id: "fallback-adult-belon-pingpong",
    name: "Lari Kepit Belon & Bawa Bola Ping Pong Dalam Sudu",
    description: "Adult.",
    category: "Adult",
    location: "Padang Telematch",
    startTime: "",
    endTime: "",
    maxTeamMembers: 99,
    teamCounts: { Green: 0, Yellow: 0, Red: 0, Blue: 0 },
    isFallback: true,
  },
  {
    id: "fallback-adult-4x50",
    name: "4 x 50m Lari Berganti-Ganti",
    description: "Adult.",
    category: "Adult",
    location: "Padang Telematch",
    startTime: "",
    endTime: "",
    maxTeamMembers: 99,
    teamCounts: { Green: 0, Yellow: 0, Red: 0, Blue: 0 },
    isFallback: true,
  },
  {
    id: "fallback-adult-dadu",
    name: "Dadu Makan Tuan",
    description: "Adult.",
    category: "Adult",
    location: "Padang Telematch",
    startTime: "",
    endTime: "",
    maxTeamMembers: 99,
    teamCounts: { Green: 0, Yellow: 0, Red: 0, Blue: 0 },
    isFallback: true,
  },
  {
    id: "fallback-adult-bola-pelikat",
    name: "Bola Pelikat",
    description: "Adult.",
    category: "Adult",
    location: "Padang Telematch",
    startTime: "",
    endTime: "",
    maxTeamMembers: 99,
    teamCounts: { Green: 0, Yellow: 0, Red: 0, Blue: 0 },
    isFallback: true,
  },
];


function isOfficialGameForCategory(game, category) {
  const name = normalizeTelematchGameName(game?.name);
  const source = category === "Kid" ? officialKidGameAliases : officialAdultGameAliases;

  return source.some((alias) =>
    name.includes(normalizeTelematchGameName(alias))
  );
}

function getOfficialGameCategory(game) {
  if (isOfficialGameForCategory(game, "Kid")) return "Kid";
  if (isOfficialGameForCategory(game, "Adult")) return "Adult";
  return game?.category || "";
}


function TelematchPage({ staff }) {
  const house = getHouseMeta(staff.team);
  const participants = useMemo(() => {
    const ownerLoginCode = String(staff.loginCode || `${staff.companyCode || ""}-${staff.staffNo || ""}`).toUpperCase();
    const teamColor = houseToTeamColor(staff.team);
    const staffMemberRow = (staff.familyMembers || []).find((member) => member?.isStaff);
    const staffAge = Number(staff.age || staffMemberRow?.age || 0);

    const list = [
      {
        key: `staff-${staff.companyCode}-${staff.staffNo}`,
        name: staff.staffName,
        relation: "Staff",
        age: staffAge,
        category: "Adult",
        teamColor,
        ownerLoginCode,
        label: `${staff.companyCode}-${staff.staffNo} · ${staff.staffName}`,
        shortLabel: staff.staffName,
        badge: "Staff",
        isStaff: true,
      },
    ];

    (staff.familyMembers || []).forEach((member, index) => {
      if (member?.isStaff) {
        return;
      }

      const memberAge = Number(member.age || 0);
      const memberCategory = normalizeMemberCategory(member.category, memberAge);

      list.push({
        key: `fam-${staff.companyCode}-${staff.staffNo}-${index}`,
        name: member.name,
        relation: member.relation || "Keluarga",
        age: memberAge,
        category: memberCategory,
        teamColor,
        ownerLoginCode,
        label: `${member.name} · ${member.relation || "Keluarga"}`,
        shortLabel: member.name,
        badge: member.relation || "Keluarga",
        isStaff: false,
      });
    });

    return list;
  }, [staff]);

  const [selectedPersonKey, setSelectedPersonKey] = useState("");
  const [games, setGames] = useState([]);
  const [selectedGameIds, setSelectedGameIds] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [savingRegistration, setSavingRegistration] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState("success");

  const [selectedKidRuleId, setSelectedKidRuleId] = useState(kidTelematchRules[0].id);

  const selectedKidRule = useMemo(
    () => kidTelematchRules.find((rule) => rule.id === selectedKidRuleId) || kidTelematchRules[0],
    [selectedKidRuleId]
  );

  const [selectedAdultRuleId, setSelectedAdultRuleId] = useState(adultTelematchRules[0].id);

  const selectedAdultRule = useMemo(
    () => adultTelematchRules.find((rule) => rule.id === selectedAdultRuleId) || adultTelematchRules[0],
    [selectedAdultRuleId]
  );

  const [rulesView, setRulesView] = useState("kid");
  const [showRulesModal, setShowRulesModal] = useState(false);

  const selectedPerson = useMemo(
    () => participants.find((person) => person.key === selectedPersonKey) || null,
    [participants, selectedPersonKey]
  );

  const selectedGameLimit = selectedPerson?.category === "Kid" ? 2 : 1;
  const selectedNormalGameCount = useMemo(() => {
    if (selectedPerson?.category !== "Kid") return selectedGameIds.length;
    return selectedGameIds.reduce((count, gameId) => {
      const game = games.find((item) => String(item.id) === String(gameId));
      return count + (game && !isKidOpeningGame(game) ? 1 : 0);
    }, 0);
  }, [selectedGameIds, games, selectedPerson?.category]);
  const selectedOpeningGameCount = useMemo(() => {
    if (selectedPerson?.category !== "Kid") return 0;
    return selectedGameIds.reduce((count, gameId) => {
      const game = games.find((item) => String(item.id) === String(gameId));
      return count + (game && isKidOpeningGame(game) ? 1 : 0);
    }, 0);
  }, [selectedGameIds, games, selectedPerson?.category]);

  const visibleGames = useMemo(() => {
    if (!selectedPerson) return [];

    return games.filter((game) => {
      const officialCategory = getOfficialGameCategory(game);

      if (selectedPerson.category === "Kid") {
        return (
          officialCategory === "Kid" &&
          isKidEligibleForGame(game, selectedPerson.age)
        );
      }

      return officialCategory === "Adult";
    });
  }, [games, selectedPerson]);

  async function loadGames() {
    setLoadingGames(true);

    try {
      const response = await fetch(`${API_URL}/api/telematch/games`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal muatkan senarai game telematch.");
      }

      const backendGames = Array.isArray(result?.data) ? result.data : [];

      // Backend should normally return the official Supabase games.
      // If it returns an empty list, keep Staff View usable and visible
      // with the exact official catalogue while backend is being seeded.
      setGames(
        backendGames.length > 0
          ? backendGames
          : officialTelematchFallbackGames
      );
    } catch (error) {
      setGames(officialTelematchFallbackGames);
      setFeedbackType("error");
      setFeedbackMessage(
        "Game rasmi dipaparkan sementara. Backend/Supabase perlu disambungkan untuk simpan pendaftaran."
      );
    } finally {
      setLoadingGames(false);
    }
  }

  useEffect(() => {
    loadGames();
  }, []);

  useEffect(() => {
    if (!participants.length) {
      setSelectedPersonKey("");
      return;
    }

    setSelectedPersonKey((current) => {
      const hasCurrent = participants.some((person) => person.key === current);

      return hasCurrent ? current : participants[0].key;
    });
  }, [participants]);

  useEffect(() => {
    let cancelled = false;

    async function loadRegistrations() {
      if (!selectedPerson) {
        setSelectedGameIds([]);
        return;
      }

      setRegistrationLoading(true);

      try {
        const params = new URLSearchParams({
          ownerLoginCode: selectedPerson.ownerLoginCode,
          name: selectedPerson.name,
        });

        const response = await fetch(`${API_URL}/api/telematch/member-registrations?${params}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Gagal muatkan pendaftaran telematch.");
        }

        if (!cancelled) {
          setSelectedGameIds((result?.data?.gameIds || []).map(String));
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedGameIds([]);
          setFeedbackType("error");
          setFeedbackMessage(error.message || "Gagal muatkan pendaftaran telematch.");
        }
      } finally {
        if (!cancelled) {
          setRegistrationLoading(false);
        }
      }
    }

    loadRegistrations();

    return () => {
      cancelled = true;
    };
  }, [selectedPerson]);

  useEffect(() => {
    if (!selectedPerson) return;

    setSelectedGameIds((current) => {
      if (selectedPerson.category !== "Kid") {
        return current.length > 1 ? current.slice(0, 1) : current;
      }

      let normalCount = 0;
      return current.filter((gameId) => {
        const game = games.find((item) => String(item.id) === String(gameId));
        if (!game || isKidOpeningGame(game)) return true;
        normalCount += 1;
        return normalCount <= 2;
      });
    });
  }, [selectedPerson?.category, games]);

  useEffect(() => {
    if (!feedbackMessage) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setFeedbackMessage("");
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [feedbackMessage]);

  function validateToggle(game, willSelect) {
    if (!selectedPerson || !willSelect) return "";

    if (
      selectedPerson.category === "Kid" &&
      !isKidEligibleForGame(game, selectedPerson.age)
    ) {
      const rule = getKidGameAgeRule(game);

      if (rule) {
        return `${game.name} hanya untuk umur ${rule.minAge} - ${rule.maxAge} tahun.`;
      }

      return "Umur peserta tidak memenuhi syarat game ini.";
    }

    if (
      selectedPerson.category === "Kid" &&
      !isKidOpeningGame(game) &&
      selectedNormalGameCount >= 2
    ) {
      return "Peserta Kid hanya boleh memilih maksimum 2 game utama. Opening Game tidak dikira dalam had ini.";
    }

    if (selectedPerson.category !== "Kid" && selectedGameIds.length >= 1) {
      return "Peserta Adult hanya boleh memilih maksimum 1 game.";
    }

    if (game.category !== "Open" && selectedPerson.category !== game.category) {
      return "Kategori peserta tidak sepadan dengan kategori game.";
    }

    const team = selectedPerson.teamColor;
    const teamLabel = formatParticipantHouseColor(staff.team, team);
    const currentCount = Number(game.teamCounts?.[team] || 0);
    const limit = Number(game.maxTeamMembers || 0);

    if (limit > 0 && currentCount >= limit) {
      return `Kuota ${teamLabel} untuk game ${game.name} telah penuh.`;
    }

    return "";
  }

  function toggleGame(gameId) {
    const game = games.find((item) => String(item.id) === String(gameId));
    if (!game || !selectedPerson) return;

    const normalizedGameId = String(gameId);
    const alreadySelected = selectedGameIds.includes(normalizedGameId);
    const validationError = validateToggle(game, !alreadySelected);

    if (validationError) {
      setFeedbackType("error");
      setFeedbackMessage(validationError);
      return;
    }

    setFeedbackMessage("");
    setSelectedGameIds((prev) =>
      alreadySelected ? prev.filter((item) => item !== normalizedGameId) : [...prev, normalizedGameId]
    );
  }

  async function saveRegistrations() {
    if (!selectedPerson) return;

    setSavingRegistration(true);
    setFeedbackMessage("");

    try {
      const response = await fetch(`${API_URL}/api/telematch/member-registrations`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ownerLoginCode: selectedPerson.ownerLoginCode,
          actorLoginCode: staff.loginCode,
          name: selectedPerson.name,
          age: selectedPerson.age,
          category: selectedPerson.category,
          teamColor: selectedPerson.teamColor,
          gameIds: selectedGameIds.map(String),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal simpan pendaftaran telematch.");
      }

      await loadGames();
      setFeedbackType("success");
      setFeedbackMessage(`Pendaftaran telematch berjaya disimpan untuk ${selectedPerson.shortLabel}.`);
    } catch (error) {
      setFeedbackType("error");
      setFeedbackMessage(error.message || "Gagal simpan pendaftaran telematch.");
    } finally {
      setSavingRegistration(false);
    }
  }

  return (
    <>
      {feedbackMessage && (
        <div
          className={
            feedbackType === "error"
              ? "telematch-feedback error"
              : "telematch-feedback success"
          }
        >
          {feedbackMessage}
        </div>
      )}

      <section className="mobile-panel">
        <div className="mobile-panel-header">
          <h3>Pilih Peserta</h3>
          <span>{participants.length}</span>
        </div>

        <div className="participant-picker-mobile">
          {participants.map((person) => {
            const active = person.key === selectedPersonKey;

            return (
              <button
                key={person.key}
                type="button"
                className={active ? "participant-pill active" : "participant-pill"}
                onClick={() => setSelectedPersonKey(person.key)}
              >
                <strong>{person.shortLabel}</strong>
                <small>
                  {person.badge} · {person.category}{person.age ? ` · ${person.age} Tahun` : ""} · {formatParticipantHouseColor(staff.team, person.teamColor)}
                </small>
              </button>
            );
          })}
        </div>

        {selectedPerson && (
          <div className="participant-summary-mobile">
            <div>
              <small>Peserta Dipilih</small>
              <strong>{selectedPerson.shortLabel}</strong>
            </div>
            <div>
              <small>Kategori</small>
              <strong>
                {selectedPerson.category}
                {selectedPerson.category === "Kid" && selectedPerson.age
                  ? ` · ${selectedPerson.age} Tahun`
                  : ""}
              </strong>
            </div>
            <div>
              <small>Dipilih</small>
              <strong>{selectedPerson.category === "Kid" ? `${selectedNormalGameCount}/2` : `${selectedGameIds.length}/1`}</strong>
            </div>
          </div>
        )}
      </section>

      <section className="mobile-panel telematch-rules-launcher-panel">
        <button
          type="button"
          className="telematch-rules-launcher"
          onClick={() => { setRulesView("kid"); setShowRulesModal(true); }}
        >
          <span className="telematch-rules-launcher-icon">
            <AppIcon name="document" size={20} />
          </span>
          <div>
            <small>Game Guide</small>
            <strong>Telematch Rules</strong>
            <span>Kid & Adult</span>
          </div>
          <b>›</b>
        </button>
      </section>

      <section className="mobile-panel">
        <div className="mobile-panel-header">
          <h3>Game Telematch</h3>
          <span>{visibleGames.length}</span>
        </div>

        <div className="telematch-hint-mobile">
          {selectedPerson?.category === "Kid" ? (
            <>
              Kid umur <strong>{selectedPerson.age || "-"}</strong> tahun · maksimum 2 game utama · Opening Game tidak dikira ·
              {visibleGames.length} game sesuai umur dipaparkan.
            </>
          ) : (
            <>Adult: maksimum 1 game.</>
          )}
        </div>

        {loadingGames && <div className="empty-state-mobile"><div className="staff-game-loading-inline">
                    <div className="staff-game-loading-inline-spinner" aria-hidden="true">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <div className="staff-game-loading-inline-copy">
                      <strong>Memuatkan game telematch...</strong>
                      <small>Sila tunggu sebentar</small>
                    </div>
                  </div></div>}

        {games.some((game) => game.isFallback) && (
          <div className="telematch-feedback error">
            Game rasmi dipaparkan, tetapi backend/Supabase belum menyediakan Game ID.
            Restart backend dan tekan Refresh sebelum simpan pendaftaran.
          </div>
        )}

        <div className="game-list-mobile telematch-game-list">
          {!loadingGames && visibleGames.map((game) => {
            const checked = selectedGameIds.includes(String(game.id));
            const team = selectedPerson?.teamColor || "Green";
            const teamLabel = formatParticipantHouseColor(staff.team, team);
            const teamCount = Number(game.teamCounts?.[team] || 0);
            const teamLimit = Number(game.maxTeamMembers || 10);
            const teamAvailable = Math.max(0, teamLimit - teamCount);
            const quotaOk = checked || teamLimit <= 0 || teamCount < teamLimit;
            const selectionLimitReached =
              selectedPerson?.category === "Kid"
                ? (!isKidOpeningGame(game) && selectedNormalGameCount >= 2)
                : selectedGameIds.length >= 1;
            const disabled = !selectedPerson || (!checked && (!quotaOk || selectionLimitReached));

            return (
              <button
                type="button"
                key={game.id}
                className={checked ? "telematch-game-row selected" : "telematch-game-row"}
                disabled={disabled || registrationLoading || savingRegistration || loadingGames}
                onClick={() => toggleGame(game.id)}
              >
                <span className={checked ? "game-check checked" : "game-check"}>
                  {checked ? "✓" : ""}
                </span>

                <div>
                  <strong>{game.name}</strong>
                  <small>
                    {formatGameTimeRange(game)}
                  </small>
                  <small>
                    {game.location || "-"}
                  </small>
                  <small>
                    {getOfficialGameCategory(game)}
                    {selectedPerson?.category === "Kid" && getKidGameAgeRule(game)
                      ? `${isKidOpeningGame(game) ? " · Opening Game" : ""} · Umur ${getKidGameAgeRule(game).minAge}-${getKidGameAgeRule(game).maxAge}`
                      : ""}
                    {" · "}
                    {teamLabel}: {teamCount}/{teamLimit || 10}
                  </small>
                  <small className={teamAvailable > 0 ? "game-slot-available" : "game-slot-full"}>
                    {teamAvailable > 0
                      ? `Baki ${teamAvailable} slot untuk ${teamLabel}`
                      : `${teamLabel} sudah penuh`}
                  </small>
                </div>

                <em>{checked ? "Dipilih" : quotaOk ? `${teamAvailable} Slot` : "Penuh"}</em>
              </button>
            );
          })}
        </div>

        {!loadingGames && visibleGames.length === 0 && (
          <div className="empty-state-mobile">
            {selectedPerson?.category === "Kid"
              ? `Tiada game yang sesuai untuk umur ${selectedPerson.age || "-"} tahun.`
              : "Tiada game untuk kategori peserta ini."}
          </div>
        )}

        <div className="telematch-actions-mobile">
          <button
            type="button"
            className="telematch-save-btn"
            disabled={
              !selectedPerson ||
              savingRegistration ||
              registrationLoading ||
              loadingGames ||
              selectedGameIds.some((id) => String(id).startsWith("fallback-"))
            }
            onClick={saveRegistrations}
          >
            {savingRegistration ? "Menyimpan..." : "Simpan Pendaftaran"}
          </button>
        </div>
      </section>


      {showRulesModal && (
        <div className="telematch-rules-modal-backdrop" onClick={() => setShowRulesModal(false)}>
          <div className="telematch-rules-modal" onClick={(event) => event.stopPropagation()}>
            <div className="telematch-rules-modal-head">
              <div>
                <small>TELEMATCH RULES</small>
                <h3>{rulesView === "kid" ? "Kid Telematch" : "Adult Telematch"}</h3>
              </div>
              <button
                type="button"
                className="telematch-rules-close"
                onClick={() => setShowRulesModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="telematch-main-tabs modal-tabs">
              <button
                type="button"
                className={rulesView === "kid" ? "telematch-main-tab active" : "telematch-main-tab"}
                onClick={() => setRulesView("kid")}
              >
                Kid
              </button>
              <button
                type="button"
                className={rulesView === "adult" ? "telematch-main-tab active" : "telematch-main-tab"}
                onClick={() => setRulesView("adult")}
              >
                Adult
              </button>
            </div>

            {rulesView === "kid" ? (
              <>
                <div className="telematch-rule-chip-row modal-chip-row">
                  {kidTelematchRules.map((rule) => {
                    const active = selectedKidRule.id === rule.id;
                    return (
                      <button
                        type="button"
                        key={rule.id}
                        className={active ? `telematch-rule-chip active ${rule.accent}` : `telematch-rule-chip ${rule.accent}`}
                        onClick={() => setSelectedKidRuleId(rule.id)}
                      >
                        <span className="telematch-rule-chip-no">{rule.number}</span>
                        <div>
                          <strong>{rule.shortTitle}</strong>
                          <small>{rule.age}</small>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <article className={`kid-rule-showcase modal-showcase ${selectedKidRule.accent}`}>
                  <div className="kid-rule-topline">
                    <span className="kid-rule-number">{selectedKidRule.number}</span>
                    <span className="kid-rule-age">{selectedKidRule.age}</span>
                  </div>

                  <h4>{selectedKidRule.title}</h4>
                  <p className="kid-rule-description">{selectedKidRule.description}</p>

                  <div className="kid-rule-winbox">
                    <strong>Cara Menang</strong>
                    <p>{selectedKidRule.win}</p>
                  </div>

                  <div className="kid-rule-steps">
                    {selectedKidRule.steps.map((step, index) => (
                      <div className="kid-rule-step" key={`${selectedKidRule.id}-${index}`}>
                        <span>{index + 1}</span>
                        <p>{step}</p>
                      </div>
                    ))}
                  </div>

                  <div className="kid-rule-footer">
                    <span>Kids Telematch</span>
                    <span>Fair Play • Teamwork • Fun</span>
                  </div>
                </article>
              </>
            ) : (
              <>
                <div className="telematch-rule-chip-row modal-chip-row">
                  {adultTelematchRules.map((rule) => {
                    const active = selectedAdultRule.id === rule.id;
                    return (
                      <button
                        type="button"
                        key={rule.id}
                        className={active ? `telematch-rule-chip active ${rule.accent}` : `telematch-rule-chip ${rule.accent}`}
                        onClick={() => setSelectedAdultRuleId(rule.id)}
                      >
                        <span className="telematch-rule-chip-no">{rule.number}</span>
                        <div>
                          <strong>{rule.shortTitle}</strong>
                          <small>{rule.title}</small>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <article className={`kid-rule-showcase adult-showcase modal-showcase ${selectedAdultRule.accent}`}>
                  <div className="kid-rule-topline">
                    <span className="kid-rule-number">{selectedAdultRule.number}</span>
                    <span className="kid-rule-age">{selectedAdultRule.age}</span>
                  </div>

                  <h4>{selectedAdultRule.title}</h4>
                  <p className="kid-rule-description">{selectedAdultRule.description}</p>

                  <div className="kid-rule-winbox">
                    <strong>Cara Menang</strong>
                    <p>{selectedAdultRule.win}</p>
                  </div>

                  <div className="kid-rule-steps">
                    {selectedAdultRule.steps.map((step, index) => (
                      <div className="kid-rule-step" key={`${selectedAdultRule.id}-${index}`}>
                        <span>{index + 1}</span>
                        <p>{step}</p>
                      </div>
                    ))}
                  </div>

                  <div className="kid-rule-footer">
                    <span>Adult Telematch</span>
                    <span>Sporting • Strategy • Teamwork</span>
                  </div>
                </article>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function InfoPage({ staff }) {
  const [showMapChooser, setShowMapChooser] = useState(false);
  const [showAdminDoc, setShowAdminDoc] = useState(false);

  const mapLinks = {
    google: "https://www.google.com/maps/dir/?api=1&destination=2.847046337464386%2C101.4088330892059",
    waze: "https://waze.com/ul?ll=2.847046337464386%2C101.4088330892059&navigate=yes",
    apple: "https://maps.apple.com/?daddr=2.847046337464386,101.4088330892059",
    browser: "https://www.openstreetmap.org/?mlat=2.847046337464386&mlon=101.4088330892059#map=18/2.847046337464386/101.4088330892059",
  };

  function openMap(url) {
    window.open(url, "_blank", "noopener,noreferrer");
    setShowMapChooser(false);
  }

  if (showAdminDoc) {
    return (
      <div className="admin-doc-page">
        <button
          type="button"
          className="admin-doc-back"
          onClick={() => setShowAdminDoc(false)}
        >
          <AppIcon name="arrowLeft" size={17} />
          <span>Kembali ke Info</span>
        </button>

        <article className="admin-paper">
          <header className="admin-paper-header">
            <span className="admin-paper-icon"><AppIcon name="document" size={24} /></span>
            <div>
              <small>SCS FAMILY DAY 2026</small>
              <h2>Arahan Pentadbiran</h2>
              <p>31 Oct 2026 - 1 Nov 2026 · Amverton Cove</p>
            </div>
          </header>

          <div className="admin-paper-note">
            Paparan ini direka sebagai versi mesra telefon. Kandungan rasmi boleh dikemaskini oleh urusetia kemudian.
          </div>

          <section className="admin-paper-section">
            <span>01</span>
            <div>
              <h3>Penginapan & Check-in</h3>
              <p>Maklumat akan dikemaskini oleh urusetia.</p>
            </div>
          </section>

          <section className="admin-paper-section">
            <span>02</span>
            <div>
              <h3>Pakaian / Dress Code</h3>
              <p>Maklumat akan dikemaskini oleh urusetia.</p>
            </div>
          </section>

          <section className="admin-paper-section">
            <span>03</span>
            <div>
              <h3>Aturcara & Pergerakan</h3>
              <p>Maklumat akan dikemaskini oleh urusetia.</p>
            </div>
          </section>

          <section className="admin-paper-section">
            <span>04</span>
            <div>
              <h3>Telematch & Aktiviti Keluarga</h3>
              <p>Maklumat akan dikemaskini oleh urusetia.</p>
            </div>
          </section>

          <section className="admin-paper-section">
            <span>05</span>
            <div>
              <h3>Keselamatan & Urusetia</h3>
              <p>Maklumat akan dikemaskini oleh urusetia.</p>
            </div>
          </section>

          <footer className="admin-paper-footer">
            <AppIcon name="phone" size={16} />
            <span>Untuk pertanyaan, sila hubungi committee Family Day.</span>
          </footer>
        </article>
      </div>
    );
  }

  return (
    <>
      <section className="mobile-panel">
        <InfoRow icon="bed" label="No. Bilik" value={staff.roomNumber || "Belum ditetapkan"} />
        <InfoRow icon="table" label="No. Meja" value={staff.tableNo} />
        <div className="info-location-card">
          <span className="info-row-icon"><AppIcon name="pin" size={19} /></span>
          <div className="info-location-copy">
            <small>Lokasi</small>
            <strong>Amverton Cove Golf &amp; Island Resort Sdn. Bhd.</strong>
            <span>Reg No : 200501014876 (691923-T)</span>
            <p>
              PT673, Jalan Pulau Carey,<br />
              Mukim Jugra, 42960 Pulau Carey,<br />
              Selangor, Malaysia.
            </p>
            <span className="info-location-phone">
              Phone Number: +603-3123 3888 / +603-3123 3800
            </span>
<button
              type="button"
              className="info-location-map-btn"
              onClick={() => setShowMapChooser(true)}
              aria-label="Pilih aplikasi peta"
            >
              <AppIcon name="pin" size={16} />
              <span>Map</span>
            </button>
          </div>
        </div>
        <button
          type="button"
          className="info-action-row"
          onClick={() => setShowAdminDoc(true)}
        >
          <span className="info-row-icon"><AppIcon name="document" size={20} /></span>
          <div>
            <small>Arahan Pentadbiran</small>
            <strong>Lihat dokumen / maklumat rasmi</strong>
          </div>
          <b>›</b>
        </button>
        <InfoRow icon="phone" label="Urusetia" value="Sila hubungi committee Family Day" />
      </section>

      {showMapChooser && (
        <div
          className="map-chooser-backdrop"
          role="presentation"
          onClick={() => setShowMapChooser(false)}
        >
          <div
            className="map-chooser-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-chooser-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="map-chooser-handle" aria-hidden="true" />
            <div className="map-chooser-header">
              <div>
                <small>Buka Dengan</small>
                <h3 id="map-chooser-title">Pilih Aplikasi Peta</h3>
              </div>
              <button
                type="button"
                className="map-chooser-close"
                onClick={() => setShowMapChooser(false)}
                aria-label="Tutup"
              >
                ×
              </button>
            </div>

            <div className="map-chooser-options">
              <button type="button" onClick={() => openMap(mapLinks.google)}>
                <span className="map-app-icon map-app-google">G</span>
                <div>
                  <strong>Google Maps</strong>
                  <small>Android / iPhone / Browser</small>
                </div>
              </button>

              <button type="button" onClick={() => openMap(mapLinks.waze)}>
                <span className="map-app-icon map-app-waze">W</span>
                <div>
                  <strong>Waze</strong>
                  <small>Navigation ke resort</small>
                </div>
              </button>

              <button type="button" onClick={() => openMap(mapLinks.apple)}>
                <span className="map-app-icon map-app-apple">A</span>
                <div>
                  <strong>Apple Maps</strong>
                  <small>Terbaik untuk iPhone / iPad</small>
                </div>
              </button>

              <button type="button" onClick={() => openMap(mapLinks.browser)}>
                <span className="map-app-icon map-app-browser"><AppIcon name="pin" size={17} /></span>
                <div>
                  <strong>Browser Map</strong>
                  <small>OpenStreetMap fallback</small>
                </div>
              </button>
            </div>

            <p className="map-chooser-note">
              Jika aplikasi pilihan tidak dipasang, pautan akan dibuka melalui browser.
            </p>
          </div>
        </div>
      )}

    </>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="info-row-mobile">
      <span className="info-row-icon"><AppIcon name={icon} size={20} /></span>
      <div>
        <small>{label}</small>
        <strong>{value || "Belum ditetapkan"}</strong>
      </div>
      <b>›</b>
    </div>
  );
}

function ProfilePage({ staff, onLogout }) {
  const house = getHouseMeta(staff.team);

  return (
    <>
      <section className="mobile-panel">
        <InfoRow icon="building" label="Syarikat / Trainee" value={getDisplayLoginGroup(staff)} />
        <InfoRow icon="check" label="Kehadiran" value={staff.attendance} />
        <InfoRow icon="bed" label="No. Bilik" value={staff.roomNumber || "Belum ditetapkan"} />
        <InfoRow icon="table" label="No. Meja" value={staff.tableNo} />
        <InfoRow icon="shield" label="Rumah" value={house.label} />
        <InfoRow
          icon="award"
          label="Penerima Anugerah"
          value={staff.isAwardRecipient ? staff.awardInfo?.awardTitle || "Ya" : "Tidak"}
        />
        <InfoRow
          icon="user"
          label="Jawatankuasa"
          value={staff.isCommittee ? staff.committeeLabel || "AJK" : "Tidak"}
        />
      </section>

      <button className="logout-mobile" onClick={onLogout}>
        <AppIcon name="logout" size={18} />
        <span>Log Keluar</span>
      </button>
    </>
  );
}

export default function StaffApp() {
  const [staff, setStaff] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [checkingSession, setCheckingSession] = useState(true);

  function handleTabChange(nextTab) {
    setActiveTab(nextTab);

    if (nextTab === "karaoke") {
      // This runs directly from the user's tap, which gives mobile browsers
      // the best chance to allow audio playback.
      startFamilyDayKaraokeMusic();
    } else {
      stopFamilyDayKaraokeMusic();
    }
  }

  const pageTitle = useMemo(() => {
    const found = tabs.find((x) => x.key === activeTab);
    return found?.label || "Home";
  }, [activeTab]);

  useEffect(() => {
    async function restoreSession() {
      const companyCode = localStorage.getItem("familyDayStaffCompany");
      const staffNo = localStorage.getItem("familyDayStaffNo");
      const loginGroup = localStorage.getItem("familyDayStaffLoginGroup");
      const savedLoginIdentity = localStorage.getItem("familyDayStaffLoginIdentity");
      let loginIdentity = null;

      try {
        loginIdentity = savedLoginIdentity ? JSON.parse(savedLoginIdentity) : null;
      } catch {
        loginIdentity = null;
      }

      if (!companyCode || !staffNo) {
        setCheckingSession(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/staff/${companyCode}/${staffNo}`);
        const result = await response.json();

        if (result.success) {
          setStaff({
            ...result.data,
            loginGroup: loginGroup || result.data?.loginGroup || result.data?.companyCode || companyCode,
            loginIdentity: loginIdentity || result.data?.loginIdentity || null,
          });
        } else {
          localStorage.removeItem("familyDayStaffCompany");
          localStorage.removeItem("familyDayStaffNo");
        }
      } catch {
        localStorage.removeItem("familyDayStaffCompany");
        localStorage.removeItem("familyDayStaffNo");
      } finally {
        setCheckingSession(false);
      }
    }

    restoreSession();
  }, []);

  // Register service worker and subscribe to push notifications for this staff
  useEffect(() => {
    if (!staff) return;

    async function registerAndSubscribe() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.log("[PUSH] Service Worker or Push not supported in this browser.");
        return;
      }

      try {
        const reg = await navigator.serviceWorker.register("/sw.js");

        const vapidRes = await fetch(`${API_URL}/api/push/vapid-public`);
        if (!vapidRes.ok) {
          console.warn("[PUSH] VAPID public key not available on server.");
          return;
        }

        const { publicKey } = await vapidRes.json();

        function urlBase64ToUint8Array(base64String) {
          const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
          const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          return outputArray;
        }

        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          // Ensure server has it (fire-and-forget)
          const ownerLoginCode = (staff.loginCode || `${staff.companyCode || ""}-${staff.staffNo || ""}`).toUpperCase();
          fetch(`${API_URL}/api/push/subscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: existing, staff_id: ownerLoginCode }),
          }).catch(() => {});
          return;
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const ownerLoginCode = (staff.loginCode || `${staff.companyCode || ""}-${staff.staffNo || ""}`).toUpperCase();

        await fetch(`${API_URL}/api/push/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub, staff_id: ownerLoginCode }),
        });

        console.log("[PUSH] Subscribed for push notifications.");
      } catch (err) {
        console.warn("[PUSH] subscription failed:", err.message || err);
      }
    }

    registerAndSubscribe();
  }, [staff]);

  function logout() {
    localStorage.removeItem("familyDayStaffCompany");
    localStorage.removeItem("familyDayStaffNo");
    localStorage.removeItem("familyDayStaffLoginGroup");
    localStorage.removeItem("familyDayStaffLoginIdentity");
    stopFamilyDayKaraokeMusic();
    setStaff(null);
    setActiveTab("home");
  }

  if (checkingSession) {
    return (
      <div className="staff-loading">
        <div>Memuatkan...</div>
      </div>
    );
  }

  if (!staff) {
    return <StaffLogin onLogin={setStaff} />;
  }

  return (
    <div className="staff-app-shell">
      <main className={`staff-phone ${getHouseMeta(staff.team).className} tab-${activeTab}`}>
        <div className="staff-topbar">
          <div>
            <small>Family Day 2026</small>
            <h1>{pageTitle}</h1>
          </div>
          <div className="top-avatar"><AppIcon name="user" size={19} /><span>{staff.staffName?.charAt(0) || "S"}</span></div>
        </div>

        <HeaderCard staff={staff} />

        <div className="staff-content">
          {activeTab === "home" && (
            <HomePage staff={staff} />
          )}

          {activeTab === "program" && <ProgramPage />}

          {activeTab === "telematch" && <TelematchPage staff={staff} />}

          {activeTab === "karaoke" && <KaraokePage staff={staff} />}

          {activeTab === "info" && <InfoPage staff={staff} />}

          {activeTab === "profile" && <ProfilePage staff={staff} onLogout={logout} />}
        </div>

        <nav className="staff-bottom-nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`nav-item nav-${tab.key} ${activeTab === tab.key ? "active" : ""}`.trim()}
              onClick={() => handleTabChange(tab.key)}
            >
              <span className="nav-icon-wrap">
                <span className="nav-icon" aria-hidden="true"><AppIcon name={tab.icon} size={19} /></span>
              </span>
              <small>{tab.label}</small>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}