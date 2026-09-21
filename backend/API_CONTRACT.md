# Family Day 2026 Admin API Contract

Base URL (local): `http://localhost:5050`

## Notes

- All responses are JSON.
- Most endpoints return `{ success: boolean, ... }` except `GET /` (health/info endpoint).
- Data is built from Excel sources in `backend/data` and attendance overrides in `backend/data/staff-attendance-overrides.json`.
- Current admin frontend data load uses `GET /api/all` as the single read endpoint.
- Removed legacy read endpoints (return 404): `GET /api/dashboard`, `GET /api/participants`, `GET /api/rooms`, `GET /api/teams`, `GET /api/seating`, `GET /api/seating/:tableNo`.

---

## 1) Health / Info

### GET /

Purpose: Basic health check and data-file existence flags.

Response 200:

```json
{
  "message": "Family Day 2026 Admin API running",
  "staffFamilyFileExists": true,
  "staffFamilyFileName": "2026 List Staff & Family For DoorGift & Welcoming Gift 19.08.2026.xlsx",
  "roomFileExists": true,
  "foodSeatingFileExists": true,
  "longServiceSCSFileExists": true,
  "longServiceSESFileExists": true
}
```

---

## 2) Consolidated Admin Payload (Current)

### GET /api/all

Purpose: Single payload for admin app initial load (summary, participants, rooms, teams, seating).

Response 200 (shape):

```json
{
  "success": true,
  "data": {
    "summary": {},
    "participants": [],
    "rooms": [],
    "teams": [],
    "seating": {
      "data": [],
      "seats": [],
      "summary": {}
    }
  }
}
```

---

## 3) Legacy APIs (Removed)

### GET /api/dashboard

Purpose: Summary metrics for dashboard/report cards.

Response 200:

```json
{
  "success": true,
  "summary": {
    "totalStaff": 120,
    "totalParticipants": 420,
    "attendance": 95,
    "attendancePercent": 79.2,
    "totalRooms": 8,
    "totalTables": 26,
    "totalSeats": 260,
    "awardRecipients": 40,
    "seatingAwardRecipients": 37,
    "totalTeams": 4
  }
}
```

### GET /api/participants

Purpose: Full participant list grouped by staff login identity.

Response 200:

```json
{
  "success": true,
  "data": [
    {
      "id": "SCS-001",
      "companyCode": "SCS",
      "staffNo": "001",
      "staffName": "John Doe",
      "room": "Executive Pool Villa",
      "tableNo": "Table 5",
      "team": "Rumah Hijau",
      "attendance": "Hadir",
      "totalFamily": 3,
      "familyMembers": [
        {
          "name": "John Doe",
          "relation": "Staff",
          "age": "38",
          "sex": "M",
          "tshirtSize": "Adult L",
          "category": "Adult",
          "status": "Hadir",
          "remarks": "",
          "isStaff": true,
          "isAwardRecipient": true,
          "awardInfo": {
            "companyCode": "SCS",
            "staffNo": "001",
            "name": "John Doe",
            "nameKey": "JOHNDOE",
            "designation": "Manager",
            "division": "Operations",
            "awardTitle": "Long Service Award",
            "isAwardRecipient": true,
            "source": "SCS Long Service"
          }
        }
      ],
      "isAwardRecipient": true,
      "awardInfo": {
        "companyCode": "SCS",
        "staffNo": "001",
        "name": "John Doe",
        "nameKey": "JOHNDOE",
        "designation": "Manager",
        "division": "Operations",
        "awardTitle": "Long Service Award",
        "isAwardRecipient": true,
        "source": "SCS Long Service"
      }
    }
  ]
}
```

### GET /api/rooms

Purpose: Participant aggregation by room.

Response 200:

```json
{
  "success": true,
  "data": [
    {
      "room": "Executive Pool Villa",
      "count": 42,
      "staff": [
        {
          "staffNo": "001",
          "staffName": "John Doe",
          "totalFamily": 3,
          "isAwardRecipient": true,
          "awardInfo": {
            "awardTitle": "Long Service Award"
          }
        }
      ]
    }
  ]
}
```

### GET /api/teams

Purpose: Participant aggregation by auto-assigned team/house.

Response 200:

```json
{
  "success": true,
  "data": [
    {
      "team": "Rumah Merah",
      "count": 100,
      "players": [
        {
          "staffNo": "001",
          "staffName": "John Doe",
          "totalFamily": 3,
          "isAwardRecipient": false,
          "awardInfo": null
        }
      ]
    }
  ]
}
```

---

## 3) Seating APIs

### GET /api/seating

Purpose: Seating tables and flattened seat list, enriched with participant match and award flags.

Response 200:

```json
{
  "success": true,
  "data": [
    {
      "tableNo": "5",
      "tableName": "Table 5",
      "count": 10,
      "awardRecipients": 2,
      "seats": [
        {
          "id": "T5-1-123",
          "tableNo": "5",
          "tableName": "Table 5",
          "seatNo": "1",
          "name": "John Doe",
          "isBlueSeat": false,
          "isAwardRecipient": true,
          "category": "Penerima Anugerah",
          "sourceSheet": "Seating",
          "sourceRow": 123,
          "matched": true,
          "companyCode": "SCS",
          "staffNo": "001",
          "staffName": "John Doe",
          "relation": "Staff",
          "room": "Executive Pool Villa",
          "team": "Rumah Hijau",
          "awardInfo": {
            "awardTitle": "Long Service Award"
          }
        }
      ]
    }
  ],
  "seats": [],
  "summary": {
    "totalTables": 26,
    "totalSeats": 260,
    "awardRecipients": 37
  }
}
```

### GET /api/seating/:tableNo

Purpose: Retrieve one table only.

Path params:

- `tableNo` (string/number-like, example: `5`)

Success response 200:

```json
{
  "success": true,
  "data": {
    "tableNo": "5",
    "tableName": "Table 5",
    "count": 10,
    "awardRecipients": 2,
    "seats": []
  }
}
```

Error response 404:

```json
{
  "success": false,
  "message": "Table not found"
}
```

---

## 4) Awards API

### GET /api/awards

Purpose: Long-service award list (SCS + SES merged).

Response 200:

```json
{
  "success": true,
  "data": [
    {
      "companyCode": "SES",
      "staffNo": "045",
      "name": "Jane Doe",
      "nameKey": "JANEDOE",
      "designation": "Engineer",
      "division": "",
      "awardTitle": "Long Service 20 Years",
      "isAwardRecipient": true,
      "source": "SES Long Service"
    }
  ],
  "summary": {
    "totalAwards": 40,
    "scs": 25,
    "ses": 15
  }
}
```

---

## 5) Staff App Authentication/Profile APIs

### POST /api/staff-login

Purpose: Staff login by company + staff number.

Request body:

```json
{
  "companyCode": "SCS",
  "staffNo": "001"
}
```

Success response 200:

```json
{
  "success": true,
  "data": {
    "id": "SCS-001",
    "companyCode": "SCS",
    "staffNo": "001",
    "staffName": "John Doe",
    "room": "Executive Pool Villa",
    "tableNo": "Table 5",
    "seatNo": "1",
    "team": "Rumah Hijau",
    "attendance": "Hadir",
    "attendanceUpdatedAt": "2026-05-22T02:17:00.000Z",
    "totalFamily": 3,
    "familyMembers": [],
    "isAwardRecipient": true,
    "awardInfo": {
      "awardTitle": "Long Service Award"
    },
    "loginCode": "SCS-001",
    "seats": []
  }
}
```

Errors:

- 400 invalid company:

```json
{
  "success": false,
  "message": "Sila pilih SCS atau SES."
}
```

- 400 missing staff number:

```json
{
  "success": false,
  "message": "Sila masukkan Staff No."
}
```

- 404 unknown staff:

```json
{
  "success": false,
  "message": "Staff tidak dijumpai untuk SCS-001."
}
```

### GET /api/staff/:companyCode/:staffNo

Purpose: Restore staff profile/session payload.

Path params:

- `companyCode`: `SCS` or `SES`
- `staffNo`: raw or zero-padded number (`1`, `001`, etc.)

Success response 200:

```json
{
  "success": true,
  "data": {
    "id": "SCS-001",
    "companyCode": "SCS",
    "staffNo": "001",
    "staffName": "John Doe",
    "room": "Executive Pool Villa",
    "tableNo": "Table 5",
    "seatNo": "1",
    "team": "Rumah Hijau",
    "attendance": "Hadir",
    "attendanceUpdatedAt": "2026-05-22T02:17:00.000Z",
    "totalFamily": 3,
    "familyMembers": [],
    "isAwardRecipient": true,
    "awardInfo": {
      "awardTitle": "Long Service Award"
    },
    "loginCode": "SCS-001",
    "seats": []
  }
}
```

Error 404:

```json
{
  "success": false,
  "message": "Staff tidak dijumpai."
}
```

### POST /api/staff/:companyCode/:staffNo/attendance

Purpose: Update staff attendance override.

Request body:

```json
{
  "attendance": "Hadir"
}
```

Allowed values:

- `Hadir`
- `Tidak Hadir`

Success response 200:

```json
{
  "success": true,
  "message": "Kehadiran berjaya dikemaskini.",
  "data": {
    "id": "SCS-001",
    "attendance": "Hadir",
    "attendanceUpdatedAt": "2026-05-22T02:20:00.000Z"
  }
}
```

Errors:

- 400 invalid attendance:

```json
{
  "success": false,
  "message": "Status kehadiran tidak sah."
}
```

- 404 unknown staff:

```json
{
  "success": false,
  "message": "Staff tidak dijumpai."
}
```

---

## 6) Frontend Usage Mapping (Current)

Used by admin app:

- `GET /api/dashboard`
- `GET /api/participants`
- `GET /api/rooms`
- `GET /api/teams`
- `GET /api/seating`

Used by staff app:

- `POST /api/staff-login`
- `GET /api/staff/:companyCode/:staffNo`
- `POST /api/staff/:companyCode/:staffNo/attendance`

Defined but not currently called by frontend:

- `GET /`
- `GET /api/seating/:tableNo`
- `GET /api/awards`
