import React, { useEffect, useMemo, useState } from "react";
import amvertonCoveImage from "./assets/amverton-cove.png";

const API_URL = import.meta.env.VITE_API_URL != null
  ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
  : import.meta.env.PROD
    ? ""
    : `http://${window.location.hostname}:5050`;

const menuItems = [
  { key: "dashboard", label: "Dashboard", icon: "🏠" },
  { key: "participants", label: "Peserta", icon: "👥" },
  { key: "attendance", label: "Kehadiran", icon: "☑️" },
  { key: "rooms", label: "Jenis Bilik", icon: "🛏️" },
  { key: "seating", label: "No. Meja", icon: "🍽️" , subtitle: "50 Meja"},
  { key: "telematch", label: "Telematch", icon: "🏅" },
  { key: "program", label: "Aturcara", icon: "📅" },
  { key: "notifications", label: "Notifikasi", icon: "🔔" },
  { key: "report", label: "Laporan", icon: "📊" },
  { key: "settings", label: "Tetapan", icon: "⚙️" },
];

const programs = [
  { time: "08:00 AM", title: "Pendaftaran & Sarapan", type: "Umum" },
  { time: "10:00 AM", title: "Telematch Bermula", type: "Game" },
  { time: "12:30 PM", title: "Makan Tengah Hari", type: "Makan" },
  { time: "07:00 PM", title: "Dinner 1 & Karaoke", type: "Dinner" },
  { time: "08:30 PM", title: "Sesi Karaoke", type: "Hiburan" },
  { time: "09:30 PM", title: "Cabutan Bertuah", type: "Hadiah" },
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

const fixedRoomTypes = [
  {
    room: "Studio King",
    title: "Studio King",
    image: "",
    description: "Room type from SCS/SES Room Detail workbook.",
    aliases: ["studio king"],
  },
  {
    room: "Jumbo",
    title: "Jumbo",
    image: "",
    description: "Includes Jumbo / Jumbo Family entries from the workbook.",
    aliases: ["jumbo", "jumbo family"],
  },
  {
    room: "Family Tatami",
    title: "Family Tatami",
    image: "",
    description: "Room type from SCS/SES Room Detail workbook.",
    aliases: ["family tatami"],
  },
  {
    room: "Studio Double Queen",
    title: "Studio Double Queen",
    image: "",
    description: "Room type from SCS/SES Room Detail workbook.",
    aliases: ["studio double queen"],
  },
  {
    room: "Deluxe Suite",
    title: "Deluxe Suite",
    image: "",
    description: "Room type from SCS/SES Room Detail workbook.",
    aliases: ["deluxe suite"],
  },
  {
    room: "Double Twin Suite",
    title: "Double Twin Suite",
    image: "",
    description: "Includes sharing variants from the workbook.",
    aliases: [
      "double twin suite",
      "double twin suite sharing",
      "double twin suite (sharing)",
    ],
  },
  {
    room: "Studio Twin",
    title: "Studio Twin",
    image: "",
    description: "Includes Studio Twin sharing variants from the workbook.",
    aliases: [
      "studio twin",
      "studio twin sharing",
      "studio twin (sharing)",
      "studio twin suite sharing",
      "studio twin suite (sharing)",
    ],
  },
]

const roomInfoMap = fixedRoomTypes.reduce((acc, item) => {
  acc[item.room] = {
    title: item.title,
    image: item.image,
    description: item.description,
  };

  return acc;
}, {});

const roomChartColorMap = {
  "Studio King": "#14B8A6",          // teal
  "Jumbo": "#FACC15",                // bright yellow
  "Family Tatami": "#7C3AED",        // violet
  "Studio Double Queen": "#F97316",  // orange
  "Deluxe Suite": "#EC4899",         // pink
  "Double Twin Suite": "#2563EB",    // royal blue
  "Studio Twin": "#84CC16",          // lime green
};

const roomChartFallbackColors = [
  "#06B6D4",
  "#EF4444",
  "#8B5CF6",
  "#22C55E",
  "#F59E0B",
  "#3B82F6",
  "#D946EF",
];

function getRoomChartColor(roomName, index = 0) {
  return (
    roomChartColorMap[String(roomName || "").trim()] ||
    roomChartFallbackColors[index % roomChartFallbackColors.length]
  );
}

function buildRoomDonutBackground(roomItems) {
  const total = (roomItems || []).reduce(
    (sum, item) => sum + Number(item.count || 0),
    0
  );

  if (total <= 0) {
    return `radial-gradient(circle, var(--panel-bg) 0 50%, transparent 51%), conic-gradient(rgba(0,0,0,.08) 0 100%)`;
  }

  let cursor = 0;
  const segments = roomItems.map((item, index) => {
    const start = cursor;
    cursor += (Number(item.count || 0) / total) * 100;
    const end = index === roomItems.length - 1 ? 100 : cursor;
    return `${getRoomChartColor(item.room, index)} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });

  return `radial-gradient(circle, var(--panel-bg) 0 50%, transparent 51%), conic-gradient(${segments.join(", ")})`;
}

function normalizeRoomText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/_/g, " ")
    .replace(/\//g, " ")
    .replace(/\./g, "")
    .trim();
}

function findFixedRoomType(roomName) {
  const normalizedRoom = normalizeRoomText(roomName);

  if (!normalizedRoom) return null;

  return fixedRoomTypes.find((roomType) => {
    const mainName = normalizeRoomText(roomType.room);

    if (normalizedRoom === mainName) return true;
    if (normalizedRoom.includes(mainName)) return true;
    if (mainName.includes(normalizedRoom)) return true;

    return roomType.aliases.some((alias) => {
      const normalizedAlias = normalizeRoomText(alias);

      return (
        normalizedRoom === normalizedAlias ||
        normalizedRoom.includes(normalizedAlias) ||
        normalizedAlias.includes(normalizedRoom)
      );
    });
  });
}

function buildFixedRoomBreakdown(excelRooms) {
  const fixedMap = fixedRoomTypes.reduce((acc, roomType) => {
    acc[roomType.room] = {
      room: roomType.room,
      count: 0,
      staff: [],
      image: roomType.image,
      description: roomType.description,
      matchedFromExcel: false,
    };

    return acc;
  }, {});

  (excelRooms || []).forEach((excelRoom) => {
    const matchedType = findFixedRoomType(excelRoom.room);

    if (!matchedType) return;

    fixedMap[matchedType.room].count += Number(excelRoom.count || 0);
    fixedMap[matchedType.room].staff.push(...(excelRoom.staff || []));
    fixedMap[matchedType.room].matchedFromExcel = true;
  });

  return fixedRoomTypes.map((roomType) => fixedMap[roomType.room]);
}

function getHouseMeta(houseName) {
  const value = String(houseName || "").toLowerCase().trim();

  if (value.includes("blue sharks") || value.includes("shark")) {
    return { label: "BLUE SHARKS", className: "house-blue", imageUrl: `${API_URL}/house-images/BLUE%20SHARKS.png` };
  }

  if (value.includes("red lions") || value.includes("lion")) {
    return { label: "RED LIONS", className: "house-red", imageUrl: `${API_URL}/house-images/RED%20LIONS.png` };
  }

  if (value.includes("green lynx") || value.includes("lynx")) {
    return { label: "GREEN LYNX", className: "house-green", imageUrl: `${API_URL}/house-images/GREEN%20LYNX.png` };
  }

  if (value.includes("lilac wolves") || value.includes("wolf") || value.includes("lilac")) {
    return { label: "LILAC WOLVES", className: "house-lilac", imageUrl: `${API_URL}/house-images/LILAC%20WOLVES.png` };
  }

  if (value.includes("merah")) {
    return {
      label: "Rumah Merah",
      className: "house-red",
    };
  }

  if (value.includes("hijau")) {
    return {
      label: "Rumah Hijau",
      className: "house-green",
    };
  }

  if (value.includes("kuning")) {
    return {
      label: "Rumah Kuning",
      className: "house-yellow",
    };
  }

  if (value.includes("biru")) {
    return {
      label: "Rumah Biru",
      className: "house-blue",
    };
  }

  return {
    label: houseName || "Rumah",
    className: "house-default",
  };
}

function HouseColorBox({ houseName }) {
  const house = getHouseMeta(houseName);

  return (
    <div className={`house-box-wrap ${house.className}`} title={house.label}>
      {house.imageUrl ? (
        <img className="house-box-image" src={house.imageUrl} alt={house.label} />
      ) : (
        <span className={`house-box ${house.className}`} aria-label={house.label} />
      )}
    </div>
  );
}


function buildDinnerTableViewFromParticipants(participants = []) {
  const TOTAL_DINNER_TABLES = 50;
  const tableMap = new Map();

  for (let tableNo = 1; tableNo <= TOTAL_DINNER_TABLES; tableNo += 1) {
    tableMap.set(String(tableNo), {
      tableNo: String(tableNo),
      tableName: `Table ${tableNo}`,
      seats: [],
      count: 0,
      awardRecipients: 0,
    });
  }

  const seen = new Set();

  function getTableNo(value) {
    const text = String(value || "").trim();
    if (!text || /belum/i.test(text)) return "";

    const match = text.match(/(\d+)/);
    if (!match) return "";

    const number = Number(match[1]);
    if (!Number.isFinite(number) || number < 1 || number > TOTAL_DINNER_TABLES) {
      return "";
    }

    return String(number);
  }

  function addPerson(tableNo, owner, person) {
    const table = tableMap.get(tableNo);
    if (!table) return;

    const name = String(person?.name || "").trim();
    if (!name) return;

    const normalizedName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    const duplicateKey = `${tableNo}|${normalizedName}`;
    if (seen.has(duplicateKey)) return;
    seen.add(duplicateKey);

    const seatNo = String(table.seats.length + 1);
    const isAwardRecipient = !!person?.isAwardRecipient;

    table.seats.push({
      id: `DINNER-${tableNo}-${seatNo}-${normalizedName || seatNo}`,
      tableNo,
      tableName: table.tableName,
      seatNo,
      name,
      matched: true,
      companyCode: owner?.companyCode || "",
      staffNo: person?.isStaff ? owner?.staffNo || "" : "",
      staffName: owner?.staffName || "",
      relation: person?.relation || (person?.isStaff ? "Staff" : "Family"),
      room: owner?.room || "",
      roomNumber: owner?.roomNumber || "",
      team: owner?.team || "",
      isAwardRecipient,
      awardInfo: person?.awardInfo || null,
      category: isAwardRecipient ? "Penerima Anugerah" : "Peserta",
    });
  }

  (participants || []).forEach((staff) => {
    const tableNo = getTableNo(staff?.tableNo);
    if (!tableNo) return;

    addPerson(tableNo, staff, {
      name: staff?.staffName,
      relation: "Staff",
      isStaff: true,
      isAwardRecipient: staff?.isAwardRecipient,
      awardInfo: staff?.awardInfo,
    });

    (staff?.familyMembers || []).forEach((member) => {
      addPerson(tableNo, staff, {
        ...member,
        isStaff: false,
      });
    });
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

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [summary, setSummary] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [confirmedNonParticipants, setConfirmedNonParticipants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [teams, setTeams] = useState([]);
  const [seating, setSeating] = useState({
    tables: [],
    seats: [],
    summary: {
      totalTables: 50,
      totalSeats: 0,
      awardRecipients: 0,
    },
  });

  const [search, setSearch] = useState("");
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData(forceRefresh = false) {
    try {
      setLoading(true);
      setApiError("");

      if (forceRefresh) {
        await fetch(`${API_URL}/api/cache/clear`, { method: "POST" }).catch(() => {});
      }

      const allRes = await fetch(`${API_URL}/api/all`);

      if (!allRes.ok) {
        throw new Error("API response not OK");
      }

      const allData = await allRes.json();
      const payload = allData?.data || {};

      const currentParticipants = payload.participants || [];

      // Backend seating is now the authoritative Dinner Table view.
      // It includes ordinary staff/family plus table-only MCKK guests, while
      // keeping those guests out of participant/event modules.
      const backendSeating = payload.seating || {};
      const dinnerTableView = backendSeating?.data
        ? {
            tables: backendSeating.data || [],
            seats: backendSeating.seats || [],
            summary: backendSeating.summary || {
              totalTables: 50,
              totalSeats: 0,
              awardRecipients: 0,
            },
          }
        : buildDinnerTableViewFromParticipants(currentParticipants);

      setSummary({
        ...(payload.summary || {}),
        totalTables: dinnerTableView.summary.totalTables,
        totalSeats: dinnerTableView.summary.totalSeats,
        seatingAwardRecipients: dinnerTableView.summary.awardRecipients,
      });
      setParticipants(currentParticipants);
      setConfirmedNonParticipants(payload.confirmedNonParticipants || []);
      setRooms(payload.rooms || []);
      setTeams(payload.teams || []);
      setSeating(dinnerTableView);
    } catch (err) {
      console.error(err);
      setApiError(
        "Backend tidak dapat dihubungi. Pastikan backend running di http://localhost:5050"
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredParticipants = useMemo(() => {
    const q = search.toLowerCase();

    return participants.filter((p) => {
      return (
        String(p.staffName || "").toLowerCase().includes(q) ||
        String(p.staffNo || "").toLowerCase().includes(q) ||
        String(p.companyCode || "").toLowerCase().includes(q) ||
        String(p.room || "").toLowerCase().includes(q) ||
        String(p.tableNo || "").toLowerCase().includes(q) ||
        String(p.team || "").toLowerCase().includes(q) ||
        String(p.awardInfo?.awardTitle || "").toLowerCase().includes(q) ||
        String(p.awardInfo?.serviceLabel || "").toLowerCase().includes(q)
      );
    });
  }, [participants, search]);

  function handleParticipantAttendanceChange(companyCode, staffNo, attendance) {
    setParticipants((prev) => {
      return prev.map((participant) => {
        const isMatch =
          String(participant.companyCode || "") === String(companyCode || "") &&
          String(participant.staffNo || "") === String(staffNo || "");

        if (!isMatch) {
          return participant;
        }

        return {
          ...participant,
          attendance,
        };
      });
    });
  }

  return (
    <div className="admin-app" data-theme={theme}>
      <aside className="sidebar">
        <div className="logo-box family-logo">
          <div>
            <div className="logo-company">SCS</div>
            <div className="logo-family">Family Day</div>
            <div className="logo-year">2026</div>
          </div>
        </div>

        <nav className="menu">
          {menuItems.map((item) => (
            <button
              type="button"
              key={item.key}
              className={activePage === item.key ? "active" : ""}
              onClick={() => setActivePage(item.key)}
            >
              <span>{item.icon}</span>
              <b>{item.label}</b>
            </button>
          ))}
        </nav>

        <div className="admin-profile">
          <div className="avatar">A</div>
          <div>
            <strong>Admin</strong>
            <small>Pentadbir Sistem</small>
          </div>
        </div>
      </aside>

      <main className="main">
        <TopBar
          activePage={activePage}
          reload={loadAllData}
          theme={theme}
          setTheme={setTheme}
        />

        {apiError && <div className="api-error">{apiError}</div>}

        {loading && <div className="loading-box">Loading data from Excel...</div>}

        {!loading && activePage === "dashboard" && (
          <DashboardPage
            summary={summary}
            rooms={rooms}
            participants={participants}
            confirmedNonParticipants={confirmedNonParticipants}
            seating={seating}
            setActivePage={setActivePage}
          />
        )}

        {!loading && activePage === "participants" && (
          <ParticipantsPage
            search={search}
            setSearch={setSearch}
            participants={filteredParticipants}
          />
        )}

        {!loading && activePage === "attendance" && (
          <AttendancePage
            participants={participants}
            onParticipantAttendanceChange={handleParticipantAttendanceChange}
          />
        )}

        {!loading && activePage === "rooms" && <RoomsPage rooms={rooms} />}

        {!loading && activePage === "seating" && (
          <SeatingPage seating={seating} />
        )}

        {!loading && activePage === "telematch" && (
          <TelematchPage staffList={participants} />
        )}

        {!loading && activePage === "program" && (
          <ProgramPage programs={programs} />
        )}

        {!loading && activePage === "notifications" && <NotificationPage />}

        {!loading && activePage === "report" && (
          <ReportPage
            summary={summary}
            participants={participants}
            seating={seating}
          />
        )}

        {!loading && activePage === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

function TopBar({ activePage, reload, theme, setTheme }) {
  const pageTitle =
    menuItems.find((x) => x.key === activePage)?.label || "Dashboard";

  const isDark = theme === "dark";
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kuala_Lumpur",
  }).format(now);

  const dateParts = new Intl.DateTimeFormat("ms-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).formatToParts(now);

  const partValue = (type) => dateParts.find((part) => part.type === type)?.value || "";
  const weekdayRaw = partValue("weekday");
  const weekday = weekdayRaw
    ? `${weekdayRaw.charAt(0).toUpperCase()}${weekdayRaw.slice(1)}`
    : "";
  const dateLabel = `${partValue("day")} ${partValue("month")} ${partValue("year")} (${weekday})`;

  return (
    <header className="topbar">
      <div>
        <h1>
          <span>SCS FAMILY DAY 2026</span> — PANEL PENGURUSAN
        </h1>
        <p>{pageTitle} Overview</p>
      </div>

      <div className="topbar-actions">
        <button type="button" className="icon-alert" title="Notifications">
          🔔<em>12</em>
        </button>

        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? "☀ Light" : "☾ Dark"}
        </button>

        <button type="button" className="reload-btn" onClick={() => reload(true)}>
          Refresh
        </button>

        <div className="date-pill date-time-pill">
          <strong>{timeLabel}</strong>
          <small>{dateLabel}</small>
        </div>
      </div>
    </header>
  );
}

function DashboardPage({
  summary,
  rooms,
  participants,
  confirmedNonParticipants,
  seating,
  setActivePage,
}) {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [ajkDrawerOpen, setAjkDrawerOpen] = useState(false);
  const [ajkFilter, setAjkFilter] = useState("ALL");
  const [ajkSearch, setAjkSearch] = useState("");
  const [selectedAjkStaff, setSelectedAjkStaff] = useState(null);
  const [absenceDrawerOpen, setAbsenceDrawerOpen] = useState(false);
  const [absenceFilter, setAbsenceFilter] = useState("ALL");
  const [absenceSearch, setAbsenceSearch] = useState("");

  const safeSummary = summary || {
    totalStaff: 0,
    totalParticipants: 0,
    attendance: 0,
    attendancePercent: 0,
    totalRooms: 0,
    totalTables: 0,
    totalTeams: 0,
    totalSeats: 0,
    awardRecipients: 0,
    seatingAwardRecipients: 0,
  };

  const totalParticipants = Number(safeSummary.totalParticipants || 0);
  const attendance = Number(safeSummary.attendance || 0);
  const attendancePercent = Number(safeSummary.attendancePercent || 0);
  const notAttend = Math.max(totalParticipants - attendance, 0);

  // Build one AJK list from both staff owners and family members. Some committee
  // members are spouses/family (for example Nor Aziani under Ahmad Razi's record),
  // so they must count/display as their own AJK identity without becoming a fake staff.
  const ajkMembers = participants.flatMap((participant) => {
    const members = [];

    if (participant?.committeeRole === "MAIN_AJK" || participant?.committeeRole === "SUB_AJK") {
      members.push({
        ...participant,
        ajkMemberType: "STAFF",
        ownerStaff: participant,
        ownerStaffName: participant.staffName,
      });
    }

    (participant?.familyMembers || []).forEach((familyMember, index) => {
      if (familyMember?.committeeRole !== "MAIN_AJK" && familyMember?.committeeRole !== "SUB_AJK") return;

      // buildStaffGroups keeps the staff row inside familyMembers for legacy UI/data
      // compatibility. Do not add that same person a second time to the AJK drawer.
      // Genuine spouse/family AJKs (e.g. Nor Aziani under Ahmad Razi) still pass.
      const memberNameKey = String(familyMember?.name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
      const ownerNameKey = String(participant?.staffName || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
      if (familyMember?.isStaff || (memberNameKey && memberNameKey === ownerNameKey)) return;

      members.push({
        id: `${participant.id || participant.staffNo}-family-ajk-${index}`,
        staffName: familyMember.name,
        // Prefer the family member's own Staff No when present (e.g. Nor Aziani
        // is Staff No 237 even though her household owner is Ahmad Razi 155).
        staffNo: familyMember.personStaffNo || participant.staffNo,
        companyCode: participant.companyCode,
        committeeRole: familyMember.committeeRole,
        committeeLabel: familyMember.committeeLabel,
        isCommittee: true,
        ajkMemberType: "FAMILY",
        relation: familyMember.relation || "Family",
        ownerStaff: participant,
        ownerStaffName: participant.staffName,
      });
    });

    return members;
  });

  const mainAjkCount = ajkMembers.filter((p) => p?.committeeRole === "MAIN_AJK").length;
  const subAjkCount = ajkMembers.filter((p) => p?.committeeRole === "SUB_AJK").length;
  const totalAjkCount = mainAjkCount + subAjkCount;

  // Authoritative "Tidak Hadir" list comes from the Excel tabs
  // "SCS Tidak hadir" + "SES Tidak hadir". This is intentionally separate
  // from the live event attendance/check-in status.
  const absentMembers = (confirmedNonParticipants || []).map((absence) => {
    const matchedParticipant = participants.find(
      (participant) =>
        String(participant?.companyCode || "").toUpperCase() === String(absence?.companyCode || "").toUpperCase() &&
        String(participant?.staffNo || "").padStart(3, "0") === String(absence?.staffNo || "").padStart(3, "0")
    );

    return {
      ...(matchedParticipant || {}),
      ...absence,
      staffName: absence?.staffName || matchedParticipant?.staffName || "",
      staffNo: absence?.staffNo || matchedParticipant?.staffNo || "",
      companyCode: absence?.companyCode || matchedParticipant?.companyCode || "",
      relation: absence?.relation || matchedParticipant?.relation || "Staff",
      participantType: absence?.participantType || absence?.relation || matchedParticipant?.relation || "Staff",
      absenceStatus: "Tidak Hadir",
      confirmedNotJoining: true,
    };
  });
  const absentScsCount = absentMembers.filter((p) => String(p?.companyCode || "").toUpperCase() === "SCS").length;
  const absentSesCount = absentMembers.filter((p) => String(p?.companyCode || "").toUpperCase() === "SES").length;

  const openAjkDrawer = (filter = "ALL") => {
    setAjkFilter(filter);
    setAjkSearch("");
    setAjkDrawerOpen(true);
  };

  const openAbsenceDrawer = (filter = "ALL") => {
    setAbsenceFilter(filter);
    setAbsenceSearch("");
    setAbsenceDrawerOpen(true);
  };

  const fixedRoomBreakdown = buildFixedRoomBreakdown(rooms);
  const topRooms = fixedRoomBreakdown;

  const roomTotal = topRooms.reduce((sum, item) => {
    return sum + Number(item.count || 0);
  }, 0);

  const recentActivities = [
    {
      icon: "👨‍👩‍👧",
      text: `${participants[0]?.staffName || "Peserta"} mendaftar kehadiran`,
      time: "10:15 AM",
    },
    {
      icon: "🍽️",
      text: `${seating?.summary?.totalTables || 0} meja seating dimuatkan`,
      time: "10:12 AM",
    },
    {
      icon: "🏠",
      text: `${topRooms[0]?.room || "Presidential Suites - GF"} dikemaskini`,
      time: "10:10 AM",
    },
    {
      icon: "🏅",
      text: `${safeSummary.awardRecipients || 0} Penerima Anugerah`,
      time: "10:05 AM",
    },
    {
      icon: "👥",
      text: "Aturcara Dinner 1 dikemaskini",
      time: "09:30 AM",
    },
  ];

  const ringValue = Math.max(0, Math.min(100, attendancePercent));

  return (
    <div className="dashboard-shell">
      <div className="dashboard-title">
        <h2>Dashboard Overview</h2>
      </div>

      <div className="metric-grid dashboard-metrics">
        <MetricCard
          title="Jumlah Peserta"
          value={totalParticipants}
          note="Berdaftar"
          icon="👥"
          type="orange"
        />

        <MetricCard
          title="Tidak Join"
          value={absentMembers.length}
          note={`SCS ${absentScsCount} · SES ${absentSesCount}`}
          icon="🚫"
          type="absent"
          onClick={() => openAbsenceDrawer("ALL")}
          clickable
        />

        <MetricCard
          title="Bilik Disediakan"
          value={roomTotal}
          note={`${fixedRoomTypes.length} Jenis Bilik`}
          icon="🛏️"
          type="yellow"
        />

        <MetricCard
          title="Meja Disediakan"
          value={seating?.summary?.totalTables || safeSummary.totalTables || 0}
          note={`${seating?.summary?.totalSeats || 0} seat`}
          icon="🪑"
          type="orange-soft"
        />

        <MetricCard
          title="Game Telematch"
          value={9}
          note="Permainan"
          icon="🏆"
          type="teal"
        />

        <MetricCard
          title="Penerima Anugerah"
          value={safeSummary.awardRecipients || seating?.summary?.awardRecipients || 0}
          note="15 · 20 · 25 · 30 Tahun"
          icon="🏅"
          type="ring-only"
          ring={attendancePercent}
        />

        <MetricCard
          title="AJK Family Day"
          value={totalAjkCount}
          note={(
            <span className="ajk-card-breakdown">
              <button type="button" className="ajk-breakdown-btn main-ajk-count" onClick={(e) => { e.stopPropagation(); openAjkDrawer("MAIN_AJK"); }}>★ Main {mainAjkCount}</button>
              <i>•</i>
              <button type="button" className="ajk-breakdown-btn sub-ajk-count" onClick={(e) => { e.stopPropagation(); openAjkDrawer("SUB_AJK"); }}>◆ Sub {subAjkCount}</button>
            </span>
          )}
          icon="⭐"
          type="ajk"
          onClick={() => openAjkDrawer("ALL")}
          clickable
        />
      </div>

      <div className="dashboard-layout">
        <section className="panel attendance-summary-panel">
          <div className="panel-header">
            <div>
              <h2>Kehadiran</h2>
              <p className="panel-subtitle">
                Ringkasan kehadiran peserta Family Day.
              </p>
            </div>
            <span>{attendancePercent}%</span>
          </div>

          <div className="attendance-summary-main">
            <div className="attendance-big-number">
              <small>Peserta Hadir</small>
              <strong>
                {attendance} / {totalParticipants}
              </strong>
              <p>{attendancePercent}% daripada jumlah peserta berdaftar.</p>
            </div>

            <div
              className="attendance-big-ring"
              style={{
                background: `radial-gradient(circle, var(--panel-bg) 0 58%, transparent 59%), conic-gradient(var(--green) 0 ${ringValue}%, rgba(0,0,0,.08) ${ringValue}% 100%)`,
              }}
            >
              <span>{attendancePercent}%</span>
            </div>
          </div>

          <div className="attendance-status-grid">
            <div>
              <span className="status-dot ok" />
              <section>
                <small>Sudah Hadir</small>
                <strong>{attendance}</strong>
              </section>
            </div>

            <div>
              <span className="status-dot warn" />
              <section>
                <small>Belum Hadir</small>
                <strong>{notAttend}</strong>
              </section>
            </div>

            <div>
              <span className="status-dot teal" />
              <section>
                <small>Jumlah Berdaftar</small>
                <strong>{totalParticipants}</strong>
              </section>
            </div>
          </div>
        </section>

        <section className="panel room-breakdown-panel">
          <div className="panel-header">
            <h2>Pecahan Bilik</h2>
            <span>{fixedRoomTypes.length} jenis</span>
          </div>

          <div className="donut-wrap">
            <div
              className="donut-chart"
              style={{ background: buildRoomDonutBackground(topRooms) }}
            >
              <div>
                <strong>{fixedRoomTypes.length}</strong>
                <span>Jenis Bilik</span>
              </div>
            </div>

            <div className="donut-legend">
              {topRooms.map((room, index) => {
                const percent =
                  roomTotal === 0
                    ? "0.0"
                    : ((Number(room.count || 0) / roomTotal) * 100).toFixed(1);

                return (
                  <button
                    type="button"
                    key={room.room}
                    className="room-legend-row"
                    onClick={() => setSelectedRoom(room)}
                  >
                    <i className="legend-color" style={{ background: getRoomChartColor(room.room, index) }} />
                    <span>{room.room}</span>
                    <strong>
                      {room.count} ({percent}%)
                    </strong>
                    <em>i</em>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="panel activity-panel">
          <div className="panel-header">
            <h2>Aktiviti Terkini</h2>
          </div>

          <div className="activity-list">
            {recentActivities.map((item, index) => (
              <div className="activity-row" key={`${item.text}-${index}`}>
                <span>{item.icon}</span>
                <p>{item.text}</p>
                <small>{item.time}</small>
              </div>
            ))}
          </div>

          <button type="button" className="link-btn">
            Lihat Semua Aktiviti ›
          </button>
        </section>

        <section className="panel quick-action-panel">
          <div className="panel-header">
            <h2>Tindakan Pantas</h2>
          </div>

          <div className="quick-action-list">
            <button type="button" onClick={() => setActivePage("participants")}>
              <span>+</span> Tambah Peserta
            </button>

            <button type="button" onClick={() => setActivePage("rooms")}>
              <span>🏠</span> Atur Bilik
            </button>

            <button type="button" onClick={() => setActivePage("seating")}>
              <span>🍽️</span> Seating Plan
            </button>

            <button type="button" onClick={() => setActivePage("telematch")}>
              <span>🏅</span> Tambah Game
            </button>

            <button type="button" onClick={() => setActivePage("notifications")}>
              <span>🔔</span> Hantar Notifikasi
            </button>
          </div>
        </section>
      </div>

      <section className="family-day-hero">
        <div
          className="family-day-hero-image"
          style={{ backgroundImage: `url("${amvertonCoveImage}")` }}
          aria-label="Amverton Cove"
        >
          <div className="family-day-hero-shade" />
          <div className="family-day-hero-caption">
            <span className="hero-eyebrow">SCS FAMILY DAY 2026</span>
            <strong>Amverton Cove</strong>
            <small>Family • Fun • Together</small>
            <span className="hero-banner-date">31 Oct 2026 - 1 Nov 2026</span>
          </div>
        </div>

        <div className="family-day-welcome-card">
          <div className="welcome-heading-row">
            <div className="welcome-icon">☀</div>
            <span>Selamat Datang!</span>
          </div>
          <p>
            Teruskan pengurusan acara dengan lancar.<br />
            Semoga SCS Family Day 2026<br />
            berjalan dengan jayanya! 🎉
          </p>
        </div>
      </section>

      {selectedRoom && (
        <RoomInfoModal room={selectedRoom} onClose={() => setSelectedRoom(null)} />
      )}

      <AjkListDrawer
        open={ajkDrawerOpen}
        members={ajkMembers}
        filter={ajkFilter}
        setFilter={setAjkFilter}
        search={ajkSearch}
        setSearch={setAjkSearch}
        onClose={() => setAjkDrawerOpen(false)}
        onSelectStaff={(staff) => setSelectedAjkStaff(staff)}
      />

      <AbsenceListDrawer
        open={absenceDrawerOpen}
        members={absentMembers}
        filter={absenceFilter}
        setFilter={setAbsenceFilter}
        search={absenceSearch}
        setSearch={setAbsenceSearch}
        onClose={() => setAbsenceDrawerOpen(false)}
      />

      {selectedAjkStaff && (
        <StaffFamilyModal
          staff={selectedAjkStaff}
          onClose={() => setSelectedAjkStaff(null)}
        />
      )}
    </div>
  );
}

function AjkListDrawer({ open, members, filter, setFilter, search, setSearch, onClose, onSelectStaff }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const normalize = (value) => String(value || "").toLowerCase().trim();
  const query = normalize(search);
  const mainCount = members.filter((m) => m.committeeRole === "MAIN_AJK").length;
  const subCount = members.filter((m) => m.committeeRole === "SUB_AJK").length;
  const filtered = members
    .filter((m) => filter === "ALL" || m.committeeRole === filter)
    .filter((m) => !query || [m.staffName, m.staffNo, m.companyCode, m.committeeLabel, m.ownerStaffName, m.relation].some((v) => normalize(v).includes(query)))
    .sort((a, b) => String(a.staffName || "").localeCompare(String(b.staffName || "")));

  return (
    <div className="ajk-drawer-layer" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="ajk-drawer" role="dialog" aria-modal="true" aria-label="Senarai AJK Family Day">
        <div className="ajk-drawer-header">
          <div>
            <span className="ajk-drawer-kicker">Family Day 2026</span>
            <h2>Senarai AJK</h2>
            <p>{members.length} ahli · {mainCount} Main · {subCount} Sub</p>
          </div>
          <button type="button" className="ajk-drawer-close" onClick={onClose} aria-label="Tutup">×</button>
        </div>

        <div className="ajk-drawer-tabs">
          <button type="button" className={filter === "ALL" ? "active" : ""} onClick={() => setFilter("ALL")}>
            <span className="ajk-tab-inner ajk-tab-text-only">
              <span className="ajk-tab-label">All</span>
              <b className="ajk-tab-count">{members.length}</b>
            </span>
          </button>
          <button type="button" className={filter === "MAIN_AJK" ? "active ajk-main-tab" : "ajk-main-tab"} onClick={() => setFilter("MAIN_AJK")}>
            <span className="ajk-tab-inner ajk-tab-text-only">
              <span className="ajk-tab-label">Main</span>
              <b className="ajk-tab-count">{mainCount}</b>
            </span>
          </button>
          <button type="button" className={filter === "SUB_AJK" ? "active ajk-sub-tab" : "ajk-sub-tab"} onClick={() => setFilter("SUB_AJK")}>
            <span className="ajk-tab-inner ajk-tab-text-only">
              <span className="ajk-tab-label">Sub</span>
              <b className="ajk-tab-count">{subCount}</b>
            </span>
          </button>
        </div>

        <label className="ajk-drawer-search">
          <span>⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, staff no atau company..." autoFocus />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search">×</button>}
        </label>

        <div className="ajk-drawer-list">
          {filtered.map((member) => (
            <button type="button" className="ajk-member-row" key={member.id || `${member.staffNo}-${member.staffName}`} onClick={() => onSelectStaff(member.ownerStaff || member)}>
              <span className="ajk-member-avatar">{String(member.staffName || "AJK").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase()}</span>
              <span className="ajk-member-main">
                <strong>{member.staffName}</strong>
                <small>{[
                  member.companyCode,
                  member.participantType || member.relation || "Staff",
                  member.staffNo ? `Staff No ${member.staffNo}` : null,
                ].filter(Boolean).join(" · ")}</small>
              </span>
              <span className={`committee-pill ${member.committeeRole === "MAIN_AJK" ? "main-ajk" : "sub-ajk"}`}>
                {member.committeeRole === "MAIN_AJK" ? "★ Main AJK" : "◆ Sub AJK"}
              </span>
              <span className="ajk-member-chevron">›</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="ajk-drawer-empty">
              <strong>Tiada AJK dijumpai</strong>
              <span>Cuba nama atau Staff No yang lain.</span>
            </div>
          )}
        </div>

        <div className="ajk-drawer-footer">Click nama AJK untuk lihat detail staff & family.</div>
      </aside>
    </div>
  );
}

function AbsenceListDrawer({ open, members, filter, setFilter, search, setSearch, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const normalize = (value) => String(value || "").toLowerCase().trim();
  const query = normalize(search);
  const scsCount = members.filter((m) => String(m.companyCode || "").toUpperCase() === "SCS").length;
  const sesCount = members.filter((m) => String(m.companyCode || "").toUpperCase() === "SES").length;
  const filtered = members
    .filter((m) => filter === "ALL" || String(m.companyCode || "").toUpperCase() === filter)
    .filter((m) => !query || [m.staffName, m.staffNo, m.companyCode].some((v) => normalize(v).includes(query)))
    .sort((a, b) => {
      const companyCompare = String(a.companyCode || "").localeCompare(String(b.companyCode || ""));
      if (companyCompare !== 0) return companyCompare;
      return String(a.staffName || "").localeCompare(String(b.staffName || ""));
    });

  return (
    <div className="ajk-drawer-layer absence-drawer-layer" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="ajk-drawer absence-drawer" role="dialog" aria-modal="true" aria-label="Senarai Tidak Hadir">
        <div className="ajk-drawer-header">
          <div>
            <span className="ajk-drawer-kicker absence-kicker">Family Day 2026</span>
            <h2>Senarai Tidak Join</h2>
            <p>{members.length} orang · SCS {scsCount} · SES {sesCount}</p>
          </div>
          <button type="button" className="ajk-drawer-close" onClick={onClose} aria-label="Tutup">×</button>
        </div>

        <div className="ajk-drawer-tabs absence-drawer-tabs">
          <button type="button" className={filter === "ALL" ? "active" : ""} onClick={() => setFilter("ALL")}>
            <span className="ajk-tab-inner ajk-tab-text-only"><span className="ajk-tab-label">All</span><b className="ajk-tab-count">{members.length}</b></span>
          </button>
          <button type="button" className={filter === "SCS" ? "active absence-scs-tab" : "absence-scs-tab"} onClick={() => setFilter("SCS")}>
            <span className="ajk-tab-inner ajk-tab-text-only"><span className="ajk-tab-label">SCS</span><b className="ajk-tab-count">{scsCount}</b></span>
          </button>
          <button type="button" className={filter === "SES" ? "active absence-ses-tab" : "absence-ses-tab"} onClick={() => setFilter("SES")}>
            <span className="ajk-tab-inner ajk-tab-text-only"><span className="ajk-tab-label">SES</span><b className="ajk-tab-count">{sesCount}</b></span>
          </button>
        </div>

        <label className="ajk-drawer-search">
          <span>⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, staff no atau company..." autoFocus />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search">×</button>}
        </label>

        <div className="ajk-drawer-list">
          {filtered.map((member) => (
            <div className="ajk-member-row absence-member-row" key={member.id || `${member.companyCode}-${member.staffNo}`}>
              <span className="ajk-member-avatar absence-member-avatar">{String(member.staffName || "TH").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase()}</span>
              <span className="ajk-member-main">
                <strong>{member.staffName}</strong>
                <small>{[
                  member.companyCode,
                  member.participantType || member.relation || "Staff",
                  member.staffNo ? `Staff No ${member.staffNo}` : null,
                ].filter(Boolean).join(" · ")}</small>
              </span>
              <span className="absence-status-pill">Tidak Join</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="ajk-drawer-empty">
              <strong>Tiada nama dalam senarai Tidak Hadir</strong>
              <span>Sumber: tab “SCS Tidak hadir” dan “SES Tidak hadir” dalam workbook peserta.</span>
            </div>
          )}
        </div>

        <div className="ajk-drawer-footer">Sumber Excel: “SCS Tidak hadir” + “SES Tidak hadir”. Senarai ini bukan status check-in event.</div>
      </aside>
    </div>
  );
}

function MetricCard({ title, value, note, icon, type, ring, onClick, clickable }) {
  const ringValue = Math.max(0, Math.min(100, Number(ring || 0)));

  return (
    <div className={`metric-card ${type || ""} ${clickable ? "metric-card-clickable" : ""}`} onClick={onClick} role={clickable ? "button" : undefined} tabIndex={clickable ? 0 : undefined} onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}>
      <div>
        <p>{title}</p>
        <h2>{value}</h2>
        <small>{note}</small>
      </div>

      {type === "ring-only" ? (
        <div
          className="metric-ring"
          style={{
            background: `radial-gradient(circle, var(--panel-bg) 0 58%, transparent 59%), conic-gradient(var(--teal) 0 ${ringValue}%, rgba(0,0,0,.08) ${ringValue}% 100%)`,
          }}
        >
          <span>{icon}</span>
        </div>
      ) : ring ? (
        <div
          className="metric-ring small"
          style={{
            background: `radial-gradient(circle, var(--panel-bg) 0 58%, transparent 59%), conic-gradient(var(--green) 0 ${ringValue}%, rgba(0,0,0,.08) ${ringValue}% 100%)`,
          }}
        >
          <span>{icon}</span>
        </div>
      ) : (
        <div className="metric-icon">{icon}</div>
      )}
    </div>
  );
}

function ParticipantsPage({ search, setSearch, participants }) {
  const [selectedCompany, setSelectedCompany] = useState("ALL");
  const [selectedStaff, setSelectedStaff] = useState(null);

  const companySummary = useMemo(() => {
    const ses = participants.filter((p) => p.companyCode === "SES");
    const scs = participants.filter((p) => p.companyCode === "SCS");

    return [
      { key: "ALL", label: "Semua", count: participants.length },
      { key: "SES", label: "SES", count: ses.length },
      { key: "SCS", label: "SCS", count: scs.length },
    ];
  }, [participants]);

  const filteredByCompany = useMemo(() => {
    if (selectedCompany === "ALL") return participants;
    return participants.filter((p) => p.companyCode === selectedCompany);
  }, [participants, selectedCompany]);

  return (
    <section className="panel full">
      <div className="panel-header">
        <div>
          <h2>Senarai Peserta</h2>
          <p className="panel-subtitle">
            Click staff row untuk lihat ahli keluarga.
          </p>
        </div>
        <span>{filteredByCompany.length} rekod</span>
      </div>

      <div className="company-summary-grid">
        {companySummary.map((item) => (
          <button
            type="button"
            key={item.key}
            className={
              selectedCompany === item.key ? "company-card active" : "company-card"
            }
            onClick={() => setSelectedCompany(item.key)}
          >
            <small>{item.label}</small>
            <strong>{item.count}</strong>
            <span>Staff</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama, staff no, company, bilik, meja, rumah atau penerima anugerah..."
        />
        <button type="button">Export Excel</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Staff No / ID</th>
              <th>Nama Staff</th>
              <th>Family</th>
              <th>Bilik</th>
              <th>Meja</th>
              <th className="house-col-header">Rumah</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {filteredByCompany.map((p) => (
              <tr
                key={p.id}
                className={p.isAwardRecipient ? "clickable-row award-seat-row" : "clickable-row"}
                onClick={() => setSelectedStaff(p)}
              >
                <td>
                  <span
                    className={
                      p.companyCode === "SES"
                        ? "badge company-ses"
                        : "badge company-scs"
                    }
                  >
                    {p.companyCode}
                  </span>
                </td>

                <td>{p.staffNo}</td>

                <td>
                  <div className="staff-name-cell">
                    <strong>{p.staffName}</strong>

                    {p.isAwardRecipient && (
                      <span className="award-pill">
                        🏅 {p.awardInfo?.serviceLabel || "Penerima Anugerah"}
                      </span>
                    )}
                    {p.isCommittee && (
                      <span className={`committee-pill ${p.committeeRole === "MAIN_AJK" ? "main-ajk" : "sub-ajk"}`}>
                        ★ {p.committeeLabel || "AJK"}
                      </span>
                    )}
                  </div>

                  <div className="table-subtext">Click to view family</div>
                </td>

                <td>{p.totalFamily}</td>
                <td>{p.room}</td>
                <td>{p.tableNo}</td>

                <td className="house-col-cell">
                  <HouseColorBox houseName={p.team} />
                </td>

                <td>
                  <span className="badge orange">{p.attendance}</span>
                </td>
              </tr>
            ))}

            {filteredByCompany.length === 0 && (
              <tr>
                <td colSpan="8">Tiada peserta dijumpai.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedStaff && (
        <StaffFamilyModal
          staff={selectedStaff}
          onClose={() => setSelectedStaff(null)}
        />
      )}
    </section>
  );
}

function StaffFamilyModal({ staff, onClose }) {
  const familyMembers = staff.familyMembers || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="family-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{staff.staffName}</h2>

            {staff.isAwardRecipient && (
              <div className="award-banner">
                <span>🏅</span>
                <div>
                  <strong>Penerima Anugerah</strong>
                  <small>
                    {staff.awardInfo?.serviceLabel
                      ? `Long Service - ${staff.awardInfo.serviceLabel}`
                      : "Long Service Award"}
                  </small>
                </div>
              </div>
            )}

            <p>
              {staff.companyCode}-{staff.staffNo} · {staff.room} · {staff.team}
            </p>
          </div>

          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-summary">
          <div>
            <small>Total Family</small>
            <strong>{familyMembers.length}</strong>
          </div>

          <div>
            <small>Bilik</small>
            <strong>{staff.room}</strong>
          </div>

          <div>
            <small>Meja</small>
            <strong>{staff.tableNo}</strong>
          </div>
        </div>

        <div className="family-table-wrap">
          <table className="family-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama</th>
                <th>Relation</th>
                <th>Age</th>
                <th>Sex</th>
                <th>T-Shirt</th>
                <th>Category</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {familyMembers.map((member, index) => (
                <tr
                  key={`${member.name}-${index}`}
                  className={member.isAwardRecipient ? "award-seat-row" : ""}
                >
                  <td>{index + 1}</td>
                  <td>
                    <div className="staff-name-cell">
                      <strong>{member.name}</strong>

                    </div>
                  </td>
                  <td>{member.relation || "-"}</td>
                  <td>{member.age || "-"}</td>
                  <td>{member.sex || "-"}</td>
                  <td>{member.tshirtSize || "-"}</td>
                  <td>{member.category || "-"}</td>
                  <td>
                    <span className="badge teal">
                      {member.status || "Belum daftar"}
                    </span>
                  </td>
                </tr>
              ))}

              {familyMembers.length === 0 && (
                <tr>
                  <td colSpan="8">Tiada ahli keluarga dijumpai.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function AttendancePage({ participants, onParticipantAttendanceChange }) {
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState({});
  const [savingStatus, setSavingStatus] = useState({});
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setSuccessMessage("");
    }, 2200);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [successMessage]);

  const filteredParticipants = useMemo(() => {
    const q = search.toLowerCase().trim();

    return participants.filter((p) => {
      const companyMatch =
        companyFilter === "ALL" || p.companyCode === companyFilter;

      const isHadir = p.attendance === "Hadir";
      const isTidakHadir = p.attendance === "Tidak Hadir";
      const belumDaftar = !isHadir && !isTidakHadir;

      let statusMatch = statusFilter === "ALL";
      if (statusFilter === "hadir") statusMatch = isHadir;
      if (statusFilter === "tidak-hadir") statusMatch = isTidakHadir;
      if (statusFilter === "belum") statusMatch = belumDaftar;

      const searchMatch =
        !q ||
        String(p.staffName || "").toLowerCase().includes(q) ||
        String(p.staffNo || "").toLowerCase().includes(q) ||
        String(p.companyCode || "").toLowerCase().includes(q) ||
        String(p.room || "").toLowerCase().includes(q) ||
        String(p.tableNo || "").toLowerCase().includes(q) ||
        String(p.team || "").toLowerCase().includes(q) ||
        String(p.awardInfo?.awardTitle || "").toLowerCase().includes(q);

      return companyMatch && statusMatch && searchMatch;
    });
  }, [participants, companyFilter, statusFilter, search]);

  const totalSCS = participants.filter((p) => p.companyCode === "SCS").length;
  const totalSES = participants.filter((p) => p.companyCode === "SES").length;
  const totalHadir = participants.filter((p) => p.attendance === "Hadir").length;
  const totalTidakHadir = participants.filter(
    (p) => p.attendance === "Tidak Hadir"
  ).length;
  const totalBelum = participants.length - totalHadir - totalTidakHadir;

  const totalFilteredPeserta = filteredParticipants.reduce((sum, p) => {
    return sum + Number(p.totalFamily || 0);
  }, 0);

  async function markAttendance(companyCode, staffNo, status, currentAttendance) {
    if (String(currentAttendance || "") === String(status || "")) {
      return;
    }

    const key = `${companyCode}-${staffNo}`;
    setLoading((prev) => ({ ...prev, [key]: true }));
    setSavingStatus((prev) => ({ ...prev, [key]: status }));
    setError("");
    setSuccessMessage("");

    try {
      const res = await fetch(
        `${API_URL}/api/staff/${companyCode}/${staffNo}/attendance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attendance: status }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Gagal simpan kehadiran.");
      }

      onParticipantAttendanceChange(companyCode, staffNo, status);
      setSuccessMessage(`Kehadiran berjaya disimpan: ${status}.`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Gagal tandakan kehadiran.");
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
      setSavingStatus((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  return (
    <section className="panel full">
      <div className="panel-header">
        <div>
          <h2>Pengurusan Kehadiran</h2>
          <p className="panel-subtitle">
            Senarai kehadiran peserta SCS dan SES.
          </p>
        </div>

        <span>
          {filteredParticipants.length} staff · {totalFilteredPeserta} peserta
        </span>
      </div>

      {error && <div className="api-error">{error}</div>}
      {successMessage && <div className="api-success">{successMessage}</div>}

      <div className="attendance-filter-bar">
        <button
          type="button"
          className={companyFilter === "ALL" ? "active" : ""}
          onClick={() => setCompanyFilter("ALL")}
        >
          <span>Semua</span>
          <strong>{participants.length}</strong>
        </button>

        <button
          type="button"
          className={companyFilter === "SCS" ? "active" : ""}
          onClick={() => setCompanyFilter("SCS")}
        >
          <span>SCS</span>
          <strong>{totalSCS}</strong>
        </button>

        <button
          type="button"
          className={companyFilter === "SES" ? "active" : ""}
          onClick={() => setCompanyFilter("SES")}
        >
          <span>SES</span>
          <strong>{totalSES}</strong>
        </button>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama, staff no, bilik, meja, rumah atau penerima anugerah..."
        />
      </div>

      <div className="attendance-status-filter-bar">
        <button
          type="button"
          className={statusFilter === "ALL" ? "active" : ""}
          onClick={() => setStatusFilter("ALL")}
        >
          <span>Semua Status</span>
          <strong>{participants.length}</strong>
        </button>

        <button
          type="button"
          className={statusFilter === "hadir" ? "active hadir-btn" : ""}
          onClick={() => setStatusFilter("hadir")}
        >
          <span>✓ Hadir</span>
          <strong>{totalHadir}</strong>
        </button>

        <button
          type="button"
          className={statusFilter === "tidak-hadir" ? "active tidak-hadir-btn" : ""}
          onClick={() => setStatusFilter("tidak-hadir")}
        >
          <span>✗ Tidak Hadir</span>
          <strong>{totalTidakHadir}</strong>
        </button>

        <button
          type="button"
          className={statusFilter === "belum" ? "active belum-btn" : ""}
          onClick={() => setStatusFilter("belum")}
        >
          <span>○ Belum Daftar</span>
          <strong>{totalBelum}</strong>
        </button>
      </div>

      <div className="attendance-grid">
        {filteredParticipants.map((p) => {
          const key = `${p.companyCode}-${p.staffNo}`;
          const isLoading = loading[key];
          const rowSavingStatus = savingStatus[key];
          const isHadir = p.attendance === "Hadir";
          const isTidakHadir = p.attendance === "Tidak Hadir";
          const belumDaftar = !isHadir && !isTidakHadir;

          return (
            <div className="attendance-card" key={p.id}>
              <div>
                <div className="staff-name-cell">
                  <strong>{p.staffName}</strong>

                  {p.isAwardRecipient && (
                    <span className="award-pill small">
                      🏅 Penerima Anugerah
                    </span>
                  )}
                </div>

                <p>
                  {p.companyCode}-{p.staffNo} · {p.totalFamily} peserta
                </p>

                <p>
                  {p.room || "Belum ditetapkan"} ·{" "}
                  {p.tableNo || "Belum ditetapkan"}
                </p>

                <p className={`attendance-status ${isHadir ? "hadir" : isTidakHadir ? "tidak-hadir" : "belum"}`}>
                  <strong>
                    {isHadir ? "✓ Hadir" : isTidakHadir ? "✗ Tidak Hadir" : "○ Belum Daftar"}
                  </strong>
                </p>
              </div>

              <div className="attendance-actions">
                <button
                  type="button"
                  className={`yes ${isHadir ? "active" : ""}`}
                  onClick={() =>
                    markAttendance(
                      p.companyCode,
                      p.staffNo,
                      "Hadir",
                      p.attendance
                    )
                  }
                  disabled={isLoading || isHadir}
                  title={isHadir ? "Status semasa" : "Tandakan sebagai Hadir"}
                >
                  {isLoading && rowSavingStatus === "Hadir" ? "Menyimpan..." : "Hadir"}
                </button>

                <button
                  type="button"
                  className={`no ${isTidakHadir ? "active" : ""}`}
                  onClick={() =>
                    markAttendance(
                      p.companyCode,
                      p.staffNo,
                      "Tidak Hadir",
                      p.attendance
                    )
                  }
                  disabled={isLoading || isTidakHadir}
                  title={isTidakHadir ? "Status semasa" : "Tandakan sebagai Tidak Hadir"}
                >
                  {isLoading && rowSavingStatus === "Tidak Hadir" ? "Menyimpan..." : "Tidak Hadir"}
                </button>
              </div>
            </div>
          );
        })}

        {filteredParticipants.length === 0 && (
          <div className="empty-card">Tiada peserta dijumpai.</div>
        )}
      </div>
    </section>
  );
}

function RoomsPage({ rooms }) {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [ajkDrawerOpen, setAjkDrawerOpen] = useState(false);
  const [ajkFilter, setAjkFilter] = useState("ALL");
  const [ajkSearch, setAjkSearch] = useState("");
  const [selectedAjkStaff, setSelectedAjkStaff] = useState(null);

  const fixedRoomBreakdown = buildFixedRoomBreakdown(rooms);

  return (
    <section className="panel full">
      <div className="panel-header">
        <div>
          <h2>Jenis Bilik</h2>
          <p className="panel-subtitle">
            Pecahan jenis bilik berdasarkan kuantiti ROOM TYPE dalam fail Excel SCS/SES.
          </p>
        </div>
        <span>{fixedRoomBreakdown.length} jenis bilik</span>
      </div>

      <div className="room-grid">
        {fixedRoomBreakdown.map((room) => (
          <div className="room-card" key={room.room}>
            <div className="room-top">
              <h3>{room.room}</h3>
              <div>
                <span>{room.count} bilik</span>
                <button
                  type="button"
                  className="room-info-btn"
                  onClick={() => setSelectedRoom(room)}
                >
                  i
                </button>
              </div>
            </div>

            <div className="room-card-stats">
              <span>{room.staff?.length || 0} staff</span>
              <span>•</span>
              <span>{room.participantCount || 0} peserta</span>
            </div>

            <div className="mini-list room-preview-list">
              {(room.staff || []).slice(0, 4).map((s) => (
                <div key={`${room.room}-${s.staffNo}`}>
                  <span>
                    {s.staffName}
                    {s.isAwardRecipient ? " 🏅" : ""}
                  </span>
                  <strong>{s.totalFamily}</strong>
                </div>
              ))}

              {(room.staff || []).length === 0 && (
                <div className="room-empty-row">
                  <span>Belum ada data dari Excel</span>
                  <strong>0</strong>
                </div>
              )}
            </div>

            <button
              type="button"
              className="room-view-all-btn"
              onClick={() => setSelectedRoom(room)}
            >
              {(room.staff || []).length > 4
                ? `Lihat semua ${room.staff.length} staff`
                : "Lihat butiran"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        ))}
      </div>

      {selectedRoom && (
        <RoomInfoModal room={selectedRoom} onClose={() => setSelectedRoom(null)} />
      )}
    </section>
  );
}

function RoomInfoModal({ room, onClose }) {
  const info = roomInfoMap[room.room] || {
    title: room.room,
    image: "",
    description:
      "Image belum dipetakan. Letakkan fail .webp dalam frontend/public/rooms dan tambah mapping dalam roomInfoMap.",
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="room-info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{info.title}</h2>
            <p>
              {room.count} bilik · {room.participantCount || 0} peserta · {room.staff?.length || 0} staff
            </p>
          </div>

          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="room-info-body">
          {info.image ? (
            <img className="room-info-image" src={info.image} alt={info.title} />
          ) : (
            <div className="room-image-placeholder">No room image</div>
          )}

          <div className="room-info-text">
            <small>Room Info</small>
            <strong>{info.title}</strong>
            <p>{info.description}</p>

            <div className="room-guest-list">
              <small>Staff Dalam Bilik</small>

              {(room.staff || []).map((s, index) => (
                <div key={`${room.room}-${s.staffNo}`}>
                  <span className="room-guest-index">{index + 1}</span>
                  <span className="room-guest-name">
                    {s.staffName}
                    {s.isAwardRecipient ? " 🏅" : ""}
                  </span>
                  <strong>{s.totalFamily}</strong>
                </div>
              ))}

              {(room.staff || []).length === 0 && (
                <div>
                  <span>Belum ada staff dipadankan dari Excel</span>
                  <strong>0</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function SeatingPage({ seating }) {
  const [search, setSearch] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);

  const tables = seating?.tables || [];
  const seats = seating?.seats || [];
  const summary = seating?.summary || {
    totalTables: 0,
    totalSeats: 0,
    awardRecipients: 0,
  };

  const filteredTables = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return tables;

    return tables.filter((table) => {
      const tableHit =
        String(table.tableName || "").toLowerCase().includes(q) ||
        String(table.tableNo || "").toLowerCase().includes(q);

      const seatHit = (table.seats || []).some((seat) => {
        return (
          String(seat.name || "").toLowerCase().includes(q) ||
          String(seat.staffName || "").toLowerCase().includes(q) ||
          String(seat.companyCode || "").toLowerCase().includes(q) ||
          String(seat.room || "").toLowerCase().includes(q) ||
          String(seat.category || "").toLowerCase().includes(q) ||
          String(seat.awardInfo?.awardTitle || "").toLowerCase().includes(q)
        );
      });

      return tableHit || seatHit;
    });
  }, [tables, search]);

  return (
    <section className="panel full">
      <div className="panel-header">
        <div>
          <h2>No. Meja</h2>
          <p className="panel-subtitle">
            Dinner Table daripada Excel SCS / SES Dinner Table No. Penerima Anugerah ditanda secara automatik.
          </p>
        </div>
        <span>{summary.totalTables} meja</span>
      </div>

      <div className="seating-summary-grid">
        <div className="seating-summary-card">
          <small>Jumlah Meja</small>
          <strong>{summary.totalTables}</strong>
          <span>Dinner Table</span>
        </div>

        <div className="seating-summary-card">
          <small>Jumlah Peserta</small>
          <strong>{summary.totalSeats}</strong>
          <span>Peserta dengan Dinner Table</span>
        </div>

        <div className="seating-summary-card award">
          <small>Penerima Anugerah</small>
          <strong>{summary.awardRecipients}</strong>
          <span>Penerima Anugerah</span>
        </div>

        <div className="seating-summary-card">
          <small>Matched Peserta</small>
          <strong>{seats.filter((x) => x.matched).length}</strong>
          <span>Nama jumpa dalam peserta</span>
        </div>
      </div>

      <div className="toolbar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari meja, nama, staff, company atau penerima anugerah..."
        />
      </div>

      <div className="seating-table-grid">
        {filteredTables.map((table) => (
          <button
            type="button"
            className="seating-table-card"
            key={table.tableNo}
            onClick={() => setSelectedTable(table)}
          >
            <div className="seating-table-top">
              <div>
                <h3>{table.tableName}</h3>
                <p>
                  {table.count} seat · {table.awardRecipients} penerima anugerah
                </p>
              </div>
              <span>{table.tableNo}</span>
            </div>

            <div className="seating-mini-list">
              {(table.seats || []).slice(0, 5).map((seat) => (
                <div
                  key={seat.id}
                  className={seat.isAwardRecipient ? "award-row" : ""}
                >
                  <span>{seat.seatNo}</span>
                  <strong>{seat.name}</strong>
                  {seat.isAwardRecipient && <em>🏅 Penerima Anugerah</em>}
                </div>
              ))}
            </div>

            {(table.seats || []).length > 5 && (
              <small>+ {(table.seats || []).length - 5} peserta lain</small>
            )}
          </button>
        ))}

        {filteredTables.length === 0 && (
          <div className="empty-card">Tiada seating dijumpai.</div>
        )}
      </div>

      {selectedTable && (
        <SeatingModal
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
        />
      )}
    </section>
  );
}

function SeatingModal({ table, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="family-modal seating-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{table.tableName}</h2>
            <p>
              {table.count} seat · {table.awardRecipients} Penerima Anugerah
            </p>
          </div>

          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="family-table-wrap">
          <table className="family-table">
            <thead>
              <tr>
                <th>Seat</th>
                <th>Nama</th>
                <th>Kategori</th>
                <th>Matched</th>
                <th>Company</th>
                <th>Staff No / ID</th>
                <th>Staff Name</th>
                <th>Bilik</th>
              </tr>
            </thead>

            <tbody>
              {(table.seats || []).map((seat) => (
                <tr
                  key={seat.id}
                  className={seat.isAwardRecipient ? "award-seat-row" : ""}
                >
                  <td>{seat.seatNo}</td>
                  <td>
                    <strong>{seat.name}</strong>
                  </td>
                  <td>
                    {seat.isAwardRecipient ? (
                      <span className="badge award-badge">
                        🏅 Penerima Anugerah
                      </span>
                    ) : (
                      <span className="badge teal">Peserta</span>
                    )}
                  </td>
                  <td>{seat.matched ? "Yes" : "No"}</td>
                  <td>{seat.companyCode || "-"}</td>
                  <td>{seat.staffNo || "-"}</td>
                  <td>{seat.staffName || "-"}</td>
                  <td>{seat.room || "-"}</td>
                </tr>
              ))}

              {(table.seats || []).length === 0 && (
                <tr>
                  <td colSpan="8">Tiada seating dijumpai.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function houseToTeamColor(house) {
  const v = String(house || "").toLowerCase();
  if (v.includes("red lions") || v.includes("lion") || v.includes("merah") || v.includes("red")) return "Red";
  if (v.includes("green lynx") || v.includes("lynx") || v.includes("hijau") || v.includes("green")) return "Green";
  if (v.includes("blue sharks") || v.includes("shark") || v.includes("biru") || v.includes("blue")) return "Blue";
  // Supabase telematch schema currently has four colors only.
  // LILAC WOLVES remains lilac in the UI; Yellow is used only for registration compatibility.
  if (v.includes("lilac wolves") || v.includes("wolf") || v.includes("lilac") || v.includes("kuning") || v.includes("yellow")) return "Yellow";
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

function normalizeMemberCategory(cat, age) {
  const v = String(cat || "").toLowerCase();
  if (v.includes("kid") || v.includes("kanak") || v.includes("child")) return "Kid";
  if (Number(age || 0) > 0 && Number(age) < 18) return "Kid";
  return "Adult";
}

function TelematchPage({ staffList = [] }) {
  const categories = ["Adult", "Kid", "Open"];

  const staffOptions = useMemo(() => {
    const opts = [];
    const seen = new Set();

    function pushOption(option) {
      const dedupeKey = [
        String(option.ownerLoginCode || "").trim().toUpperCase(),
        String(option.name || "").trim().toLowerCase(),
        String(option.category || "").trim(),
        String(option.teamColor || "").trim(),
        String(option.label || "").trim().toLowerCase(),
      ].join("|");

      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      opts.push(option);
    }

    (staffList || []).forEach((staff) => {
      const teamColor = houseToTeamColor(staff.team);
      const teamLabel = formatTeamColor(teamColor);
      const ownerIdentifier = String(
        staff.loginCode || `${staff.companyCode || ""}-${staff.staffNo || ""}`
      ).toUpperCase();
      pushOption({
        key: `staff-${String(staff.companyCode || "").toUpperCase()}-${String(staff.staffNo || "")}`,
        companyCode: String(staff.companyCode || "").toUpperCase(),
        staffNo: String(staff.staffNo || ""),
        memberOrder: -1,
        label: `${staff.companyCode}-${staff.staffNo} · ${staff.staffName} (Staff) · ${teamLabel}`,
        name: staff.staffName,
        age: 25,
        category: "Adult",
        teamColor,
        ownerLoginCode: ownerIdentifier,
      });
      (staff.familyMembers || []).forEach((member, idx) => {
        const memberCat = normalizeMemberCategory(member.category, member.age);
        pushOption({
          key: `fam-${String(staff.companyCode || "").toUpperCase()}-${String(staff.staffNo || "")}-${idx}`,
          companyCode: String(staff.companyCode || "").toUpperCase(),
          staffNo: String(staff.staffNo || ""),
          memberOrder: idx,
          label: `${staff.companyCode}-${staff.staffNo} · ${member.name} (${member.relation || "Keluarga"}) · ${teamLabel}`,
          name: member.name,
          age: Number(member.age || 0),
          category: memberCat,
          teamColor,
          ownerLoginCode: ownerIdentifier,
        });
      });
    });

    opts.sort((a, b) => {
      const companyCompare = String(a.companyCode || "").localeCompare(
        String(b.companyCode || ""),
        undefined,
        { sensitivity: "base" }
      );
      if (companyCompare !== 0) return companyCompare;

      const staffNoCompare = String(a.staffNo || "").localeCompare(
        String(b.staffNo || ""),
        undefined,
        { numeric: true, sensitivity: "base" }
      );
      if (staffNoCompare !== 0) return staffNoCompare;

      const memberOrderCompare = Number(a.memberOrder || 0) - Number(b.memberOrder || 0);
      if (memberOrderCompare !== 0) return memberOrderCompare;

      return String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
      });
    });

    return opts;
  }, [staffList]);

  const [games, setGames] = useState([]);
  const [selectedStaffKey, setSelectedStaffKey] = useState("");
  const [selectedGameIds, setSelectedGameIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingRegistration, setSavingRegistration] = useState(false);
  const [error, setError] = useState("");
  const [participantsModalGame, setParticipantsModalGame] = useState(null);
  const [participantsModalList, setParticipantsModalList] = useState([]);
  const [participantsModalLoading, setParticipantsModalLoading] = useState(false);
  const [participantsModalError, setParticipantsModalError] = useState("");

  const [gameForm, setGameForm] = useState({
    id: "",
    name: "",
    description: "",
    category: "Adult",
    location: "",
    startTime: "",
    endTime: "",
    maxTeamMembers: 5,
  });

  const selectedPerson = useMemo(
    () => staffOptions.find((o) => o.key === selectedStaffKey) || null,
    [staffOptions, selectedStaffKey]
  );

  const visibleGames = useMemo(() => {
    if (!selectedPerson) return games;
    return games.filter(
      (g) => g.category === "Open" || g.category === selectedPerson.category
    );
  }, [games, selectedPerson]);

  async function loadGames() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_URL}/api/telematch/games`);
      if (!res.ok) throw new Error("Gagal muatkan senarai game.");
      const data = await res.json();
      setGames(data.data || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Gagal muatkan modul telematch.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGames();
  }, []);

  useEffect(() => {
    setSelectedGameIds([]);
    if (!selectedPerson) return;

    const params = new URLSearchParams({
      ownerLoginCode: selectedPerson.ownerLoginCode,
      name: selectedPerson.name,
    });

    fetch(`${API_URL}/api/telematch/member-registrations?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Gagal muatkan pendaftaran.");
        return res.json();
      })
      .then((data) => {
        setSelectedGameIds(data?.data?.gameIds || []);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || "Gagal muatkan pendaftaran peserta.");
      });
  }, [selectedStaffKey]);

  async function submitGame(e) {
    e.preventDefault();
    setError("");

    try {
      const payload = {
        name: gameForm.name,
        description: gameForm.description,
        category: gameForm.category,
        location: gameForm.location,
        startTime: gameForm.startTime,
        endTime: gameForm.endTime,
        maxTeamMembers: Number(gameForm.maxTeamMembers || 0),
      };

      const url = gameForm.id
        ? `${API_URL}/api/telematch/games/${gameForm.id}`
        : `${API_URL}/api/telematch/games`;
      const method = gameForm.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal simpan game.");

      setGameForm({ id: "", name: "", description: "", category: "Adult", location: "", startTime: "", endTime: "", maxTeamMembers: 5 });
      await loadGames();
    } catch (err) {
      console.error(err);
      setError(err.message || "Gagal simpan game.");
    }
  }

  function editGame(game) {
    setGameForm({
      id: game.id,
      name: game.name,
      description: game.description || "",
      category: game.category,
      location: game.location || "",
      startTime: game.startTime || "",
      endTime: game.endTime || "",
      maxTeamMembers: game.maxTeamMembers || 1,
    });
  }

  async function removeGame(gameId) {
    if (!window.confirm("Padam game ini?")) return;

    try {
      const res = await fetch(`${API_URL}/api/telematch/games/${gameId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal padam game.");
      await loadGames();
    } catch (err) {
      console.error(err);
      setError(err.message || "Gagal padam game.");
    }
  }

  function validateToggle(game, willSelect) {
    if (!selectedPerson || !willSelect) return "";

    if (selectedGameIds.length >= 3) {
      return "Setiap peserta hanya boleh menyertai maksimum 3 game.";
    }

    if (game.category !== "Open" && selectedPerson.category !== game.category) {
      return "Kategori peserta tidak sepadan dengan kategori game.";
    }

    const team = selectedPerson.teamColor;
    const teamLabel = formatTeamColor(team);
    const currentCount = Number(game.teamCounts?.[team] || 0);
    const limit = Number(game.maxTeamMembers || 0);

    if (limit > 0 && currentCount >= limit) {
      return `Kuota ${teamLabel} untuk game ${game.name} telah penuh.`;
    }

    return "";
  }

  function toggleGame(gameId) {
    const game = games.find((x) => x.id === gameId);
    if (!game || !selectedPerson) return;

    const alreadySelected = selectedGameIds.includes(gameId);
    const validationError = validateToggle(game, !alreadySelected);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setSelectedGameIds((prev) =>
      alreadySelected ? prev.filter((x) => x !== gameId) : [...prev, gameId]
    );
  }

  async function saveRegistrations() {
    if (!selectedPerson) return;
    setSavingRegistration(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/telematch/member-registrations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerLoginCode: selectedPerson.ownerLoginCode,
          name: selectedPerson.name,
          age: selectedPerson.age,
          category: selectedPerson.category,
          teamColor: selectedPerson.teamColor,
          gameIds: selectedGameIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal kemaskini pendaftaran game.");

      await loadGames();
    } catch (err) {
      console.error(err);
      setError(err.message || "Gagal kemaskini pendaftaran game.");
    } finally {
      setSavingRegistration(false);
    }
  }

  async function openParticipantsModal(game) {
    setParticipantsModalGame(game);
    setParticipantsModalList([]);
    setParticipantsModalError("");
    setParticipantsModalLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/telematch/games/${game.id}/participants`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Gagal muatkan senarai peserta game.");
      }

      setParticipantsModalGame(data?.data?.game || game);
      setParticipantsModalList(data?.data?.participants || []);
    } catch (err) {
      console.error(err);
      setParticipantsModalError(err.message || "Gagal muatkan senarai peserta game.");
    } finally {
      setParticipantsModalLoading(false);
    }
  }

  function closeParticipantsModal() {
    setParticipantsModalGame(null);
    setParticipantsModalList([]);
    setParticipantsModalError("");
    setParticipantsModalLoading(false);
  }

  const isOpeningGame = (game) =>
    String(game?.name || "").trim().toLowerCase() === "cari barang tersembunyi";

  const getTelematchSectionKey = (game) => {
    if (isOpeningGame(game)) return "Opening";
    if (game.category === "Kid") return "Kid";
    if (game.category === "Adult") return "Adult";
    return game.category || "Other";
  };

  const groupedGames = [...games].sort((a, b) => {
    // Cari Barang Tersembunyi is an Opening Game (Kid 3-7 tahun),
    // so keep it in its own section without changing the backend category.
    const rank = { Opening: 0, Kid: 1, Adult: 2, Open: 3 };
    const aRank = rank[getTelematchSectionKey(a)] ?? 99;
    const bRank = rank[getTelematchSectionKey(b)] ?? 99;
    if (aRank !== bRank) return aRank - bRank;
    return 0;
  });

  if (loading) {
    return <section className="panel full"><div className="telematch-loading-state">
          <div className="telematch-loading-orbit" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <strong>Loading Telematch Data...</strong>
          <small>Sila tunggu sebentar</small>
        </div></section>;
  }

  return (
    <section className="panel full">
      <div className="panel-header">
        <div>
          <h2>Telematch</h2>
          <p className="panel-subtitle">Urus game dan daftar peserta.</p>
        </div>
        <span>{games.length} game</span>
      </div>

      {error && <div className="api-error">{error}</div>}

      <div className="page-grid telematch-grid">
        <div className="panel telematch-main-panel">
          <div className="panel-header">
            <h2>Game Management</h2>
            <span>{games.length}</span>
          </div>

          <form className="toolbar" onSubmit={submitGame}>
            <input
              value={gameForm.name}
              onChange={(e) => setGameForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nama game"
            />
            <input
              value={gameForm.location}
              onChange={(e) => setGameForm((prev) => ({ ...prev, location: e.target.value }))}
              placeholder="Lokasi"
            />
            <input
              value={gameForm.startTime}
              onChange={(e) => setGameForm((prev) => ({ ...prev, startTime: e.target.value }))}
              placeholder="Masa Mula (cth: 10:00 AM)"
            />
            <input
              value={gameForm.endTime}
              onChange={(e) => setGameForm((prev) => ({ ...prev, endTime: e.target.value }))}
              placeholder="Masa Tamat (cth: 10:30 AM)"
            />
            <input
              value={gameForm.description}
              onChange={(e) => setGameForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Description"
            />
            <select
              value={gameForm.category}
              onChange={(e) => setGameForm((prev) => ({ ...prev, category: e.target.value }))}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={gameForm.maxTeamMembers}
              onChange={(e) => setGameForm((prev) => ({ ...prev, maxTeamMembers: e.target.value }))}
              placeholder="Max/Team"
            />
            <button type="submit">{gameForm.id ? "Kemaskini" : "Simpan"}</button>
            {gameForm.id && (
              <button
                type="button"
                onClick={() =>
                  setGameForm({ id: "", name: "", description: "", category: "Adult", location: "", startTime: "", endTime: "", maxTeamMembers: 5 })
                }
              >
                Cancel
              </button>
            )}
          </form>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Masa</th>
                  <th>Category</th>
                  <th>MAX/TEAM</th>
                  <th>Quota (H/L/M/B)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedGames.map((game, index) => {
                  const sectionKey = getTelematchSectionKey(game);
                  const previousSectionKey =
                    index > 0 ? getTelematchSectionKey(groupedGames[index - 1]) : null;
                  const showCategoryHeader = previousSectionKey !== sectionKey;
                  const sectionTitle =
                    sectionKey === "Opening"
                      ? "OPENING GAME — KID (3–7 TAHUN)"
                      : sectionKey === "Kid"
                        ? "KIDS TELEMATCH"
                        : sectionKey === "Adult"
                          ? "ADULT TELEMATCH"
                          : `${sectionKey} TELEMATCH`;

                  return (
                    <React.Fragment key={game.id}>
                      {showCategoryHeader && (
                        <tr className={`telematch-category-row ${String(sectionKey || "").toLowerCase()}`}>
                          <td colSpan="6">
                            <span className="telematch-category-title">{sectionTitle}</span>
                          </td>
                        </tr>
                      )}
                      <tr>
                    <td>
                      <button
                        type="button"
                        className="table-link-btn"
                        onClick={() => openParticipantsModal(game)}
                      >
                        {game.name}
                      </button>
                      <div className="table-subtext">{game.location || "-"}</div>
                    </td>
                    <td>
                      {game.startTime || game.endTime ? (
                        <>
                          <div>{game.startTime || "-"}</div>
                          <div className="table-subtext">{game.endTime || ""}</div>
                        </>
                      ) : "-"}
                    </td>
                    <td>{isOpeningGame(game) ? "Kid (3–7 Tahun)" : game.category}</td>
                    <td>{game.maxTeamMembers}</td>
                    <td>
                      {game.teamCounts?.Green || 0}/{game.teamCounts?.Yellow || 0}/
                      {game.teamCounts?.Red || 0}/{game.teamCounts?.Blue || 0}
                    </td>
                    <td>
                      <div className="telematch-admin-actions">
                        <button
                          type="button"
                          className="telematch-admin-action edit"
                          onClick={() => editGame(game)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="telematch-admin-action delete"
                          onClick={() => removeGame(game.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel telematch-side-panel">
          <div className="panel-header">
            <h2>Game Registration Dashboard</h2>
            <span>{selectedPerson ? selectedGameIds.length : 0}/3 game dipilih</span>
          </div>

          <div className="toolbar">
            <select
              value={selectedStaffKey}
              onChange={(e) => {
                setSelectedStaffKey(e.target.value);
                setError("");
              }}
            >
              <option value="">Pilih peserta...</option>
              {staffOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={saveRegistrations}
              disabled={!selectedPerson || savingRegistration}
            >
              {savingRegistration ? "Simpan..." : "Simpan Pendaftaran"}
            </button>
          </div>

          {selectedPerson && (
            <div className="table-subtext" style={{ padding: "4px 0 12px" }}>
              Kategori: <strong>{selectedPerson.category}</strong> · Team:{" "}
              <strong>{formatTeamColor(selectedPerson.teamColor)}</strong> · Menunjukkan game kategori{" "}
              <strong>{selectedPerson.category}</strong> dan <strong>Open</strong>
            </div>
          )}

          {selectedPerson && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Join</th>
                    <th>Game</th>
                    <th>Category</th>
                    <th>Team Quota</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleGames.map((game) => {
                    const checked = selectedGameIds.includes(game.id);
                    const team = selectedPerson.teamColor;
                    const teamLabel = formatTeamColor(team);
                    const teamCount = Number(game.teamCounts?.[team] || 0);
                    const teamLimit = Number(game.maxTeamMembers || 0);
                    const quotaOk = checked || teamLimit <= 0 || teamCount < teamLimit;
                    const disabled = !checked && (!quotaOk || selectedGameIds.length >= 3);

                    return (
                      <tr key={game.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleGame(game.id)}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="table-link-btn"
                            onClick={() => openParticipantsModal(game)}
                          >
                            {game.name}
                          </button>
                          <div className="table-subtext">{game.location || "-"}</div>
                        </td>
                        <td>{game.category}</td>
                        <td>
                          {teamCount}/{teamLimit} ({teamLabel})
                        </td>
                        <td>
                          {!quotaOk ? (
                            <span className="badge orange">Quota full</span>
                          ) : (
                            <span className="badge teal">Available</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {visibleGames.length === 0 && (
                    <tr>
                      <td colSpan="5">Tiada game sepadan untuk peserta ini.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {participantsModalGame && (
        <TelematchParticipantsModal
          game={participantsModalGame}
          participants={participantsModalList}
          loading={participantsModalLoading}
          error={participantsModalError}
          onClose={closeParticipantsModal}
        />
      )}
    </section>
  );
}

function TelematchParticipantsModal({ game, participants, loading, error, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="family-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{game.name}</h2>
            <p>
              {game.category} · {game.location || "Lokasi belum ditetapkan"}
              {(game.startTime || game.endTime) && (
                <> · {game.startTime || ""}{game.startTime && game.endTime ? " - " : ""}{game.endTime || ""}</>
              )}
            </p>
          </div>

          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-summary">
          <div>
            <small>Jumlah Peserta</small>
            <strong>{participants.length}</strong>
          </div>

          <div>
            <small>Kategori</small>
            <strong>{game.category}</strong>
          </div>

          <div>
            <small>Kuota / Team</small>
            <strong>{game.maxTeamMembers || 0}</strong>
          </div>
        </div>

        <div className="family-table-wrap">
          {loading ? (
            <div className="empty-card" style={{ margin: "18px 0" }}>
              Loading peserta game...
            </div>
          ) : error ? (
            <div className="api-error" style={{ margin: "18px 0" }}>
              {error}
            </div>
          ) : (
            <table className="family-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama</th>
                  <th>Kategori</th>
                  <th>Team</th>
                  <th>Owner</th>
                </tr>
              </thead>

              <tbody>
                {participants.map((participant, index) => (
                  <tr key={participant.id}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{participant.name}</strong>
                    </td>
                    <td>{participant.category}</td>
                    <td>{formatTeamColor(participant.teamColor)}</td>
                    <td>{participant.ownerLoginCode || "-"}</td>
                  </tr>
                ))}

                {participants.length === 0 && (
                  <tr>
                    <td colSpan="5">Belum ada peserta untuk game ini.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}


function ProgramPage({ programs }) {
  return (
    <section className="panel full">
      <div className="panel-header">
        <h2>Aturcara Program</h2>
        <span>{programs.length} aktiviti</span>
      </div>

      <div className="program-list">
        {programs.map((item) => (
          <div className="program-row" key={`${item.time}-${item.title}`}>
            <div className="program-time">{item.time}</div>
            <div>
              <strong>{item.title}</strong>
              <p>{item.type}</p>
            </div>
            <button type="button">Edit</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function NotificationPage() {
    const [subscribers, setSubscribers] = useState([]);
    const [loadingSubs, setLoadingSubs] = useState(false);
    const [subsError, setSubsError] = useState("");

    async function fetchSubscribers() {
      setLoadingSubs(true);
      setSubsError("");
      try {
        const res = await fetch(`${API_URL}/api/push/subscriptions`);
        const data = await res.json();
        if (res.ok && data.success) {
          setSubscribers(data.data || []);
        } else {
          setSubsError(data.message || "Gagal muatkan senarai subscriber.");
        }
      } catch (err) {
        setSubsError(err.message || "Gagal muatkan senarai subscriber.");
      } finally {
        setLoadingSubs(false);
      }
    }

    useEffect(() => {
      fetchSubscribers();
    }, []);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  async function fetchHistory() {
    setLoadingHistory(true);
    setHistoryError("");
    try {
      const res = await fetch(`${API_URL}/api/push/notification-history`);
      const data = await res.json();
      if (res.ok && data.success) {
        setHistory(data.data || []);
      } else {
        setHistoryError(data.message || "Gagal muatkan sejarah notifikasi.");
      }
    } catch (err) {
      setHistoryError(err.message || "Gagal muatkan sejarah notifikasi.");
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  async function send() {
    setSending(true);
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/api/push/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, audience }),
      });

      const data = await res.json();
      setResult({ ok: res.ok, data });
      // Refresh history after sending
      fetchHistory();
    } catch (err) {
      setResult({ ok: false, error: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="panel full">
      <div className="panel-header">
        <div>
          <h2>Notifikasi</h2>
          <p className="panel-subtitle">Hantar makluman kepada peserta dan committee.</p>
        </div>
        <span>Live</span>
      </div>

      <div className="panel-body">
        <form className="toolbar" onSubmit={e => { e.preventDefault(); send(); }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Tajuk notifikasi"
            style={{ minWidth: 220 }}
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Mesej notifikasi"
            rows={2}
            minLength={1}
            maxLength={500}
            style={{
              minWidth: 320,
              maxWidth: 600,
              minHeight: 48,
              maxHeight: 180,
              resize: 'vertical',
              fontFamily: 'inherit',
              fontSize: 16,
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid #ccc',
              boxSizing: 'border-box',
              lineHeight: 1.5,
            }}
            onInput={e => {
              // Auto-grow textarea height
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px';
            }}
          />
          <select
            value={audience}
            onChange={e => setAudience(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="all">All Staff</option>
            <option value="main_ajk">Main AJK</option>
            <option value="sub_ajk">Sub AJK</option>
            <option value="all_ajk">All AJK (Main + Sub)</option>
            <option value="telematch">Telematch Participants</option>
          </select>
          <button type="submit" disabled={sending || !title || !body}>
            {sending ? "Sending..." : "Send Notification"}
          </button>
        </form>

        {result && (
          <div style={{ marginTop: 12 }}>
            <strong>Result:</strong>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="panel-body" style={{ marginTop: 32 }}>
        <h3>Sejarah Notifikasi</h3>
        {loadingHistory && <div>Loading history...</div>}
        {historyError && <div className="api-error">{historyError}</div>}
        {!loadingHistory && !historyError && history.length === 0 && (
          <div>Belum ada notifikasi dihantar.</div>
        )}
        {!loadingHistory && !historyError && history.length > 0 && (
          <table className="notification-history-table" style={{ width: "100%", marginTop: 8 }}>
            <thead>
              <tr>
                <th>Tarikh</th>
                <th>Title</th>
                <th>Message</th>
                <th>Audience</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, idx) => {
                // Support both sent_at (Supabase) and sentAt (legacy/local)
                const sentAt = item.sent_at || item.sentAt;
                let dateStr = "";
                if (sentAt) {
                  const dt = new Date(sentAt);
                  // Malaysia time: UTC+8
                  dateStr = dt.toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" });
                } else {
                  dateStr = "-";
                }
                return (
                  <tr key={idx}>
                    <td>{dateStr}</td>
                    <td>{item.title}</td>
                    <td>{item.body}</td>
                    <td>{item.audience}</td>
                    <td>{item.result_count ?? item.resultCount ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 40 }}>
          <h3>Notification Subscribers</h3>
          {loadingSubs && <div>Loading subscribers...</div>}
          {subsError && <div className="api-error">{subsError}</div>}
          {!loadingSubs && !subsError && subscribers.length === 0 && (
            <div>No subscribers found.</div>
          )}
          {!loadingSubs && !subsError && subscribers.length > 0 && (
            <table className="notification-history-table" style={{ width: "100%", marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Name/Staff ID</th>
                  <th>Device Type</th>
                  <th>Subscribe Date</th>
                  <th>Endpoint</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub, idx) => {
                  let dateStr = "-";
                  if (sub.created_at) {
                    const dt = new Date(sub.created_at);
                    dateStr = dt.toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" });
                  }
                  let endpoint = sub.subscription?.endpoint || "-";
                  return (
                    <tr key={idx}>
                      <td>{sub.staff_id || "-"}</td>
                      <td>{sub.device_type || "-"}</td>
                      <td>{dateStr}</td>
                      <td style={{ maxWidth: 200, wordBreak: "break-all" }}>{endpoint}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

function ReportPage({ summary, participants, seating }) {
  return (
    <section className="panel full">
      <div className="panel-header">
        <h2>Laporan Ringkas</h2>
        <span>Preview</span>
      </div>

      <div className="report-box">
        <h3>Family Day 2026 Report</h3>
        <p>Jumlah staff: {summary?.totalStaff || 0}</p>
        <p>Jumlah peserta termasuk family: {summary?.totalParticipants || 0}</p>
        <p>Jumlah rekod peserta: {participants.length}</p>
        <p>Kehadiran: {summary?.attendancePercent || 0}%</p>
        <p>Jenis bilik: {fixedRoomTypes.length}</p>
        <p>Jumlah meja: {seating?.summary?.totalTables || 0}</p>
        <p>Jumlah seat: {seating?.summary?.totalSeats || 0}</p>
        <p>Penerima Anugerah: {summary?.awardRecipients || 0}</p>
        <p>15 Tahun: {summary?.awardServiceBreakdown?.find((x) => x.years === 15)?.count || 0}</p>
        <p>20 Tahun: {summary?.awardServiceBreakdown?.find((x) => x.years === 20)?.count || 0}</p>
        <p>25 Tahun: {summary?.awardServiceBreakdown?.find((x) => x.years === 25)?.count || 0}</p>
        <p>30 Tahun: {summary?.awardServiceBreakdown?.find((x) => x.years === 30)?.count || 0}</p>
      </div>
    </section>
  );
}

function SettingsPage() {
  return (
    <section className="panel full">
      <div className="panel-header">
        <h2>Tetapan Sistem</h2>
      </div>

      <div className="settings-list">
        <div>
          <strong>Nama Event</strong>
          <p>SCS Family Day 2026</p>
        </div>

        <div>
          <strong>Tarikh</strong>
          <p>12 Julai 2026</p>
        </div>

        <div>
          <strong>Mode</strong>
          <p>No Login · Admin Local PWA</p>
        </div>
      </div>
    </section>
  );
}

export default App;
