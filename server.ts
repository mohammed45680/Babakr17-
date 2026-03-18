import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("meetings.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT
  );

  CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'draft'
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER,
    member_id INTEGER,
    content TEXT,
    type TEXT, -- 'observation', 'technical', 'field_result', 'expectation'
    FOREIGN KEY(meeting_id) REFERENCES meetings(id),
    FOREIGN KEY(member_id) REFERENCES members(id)
  );

  CREATE TABLE IF NOT EXISTS meeting_attendees (
    meeting_id INTEGER,
    member_id INTEGER,
    PRIMARY KEY (meeting_id, member_id),
    FOREIGN KEY(meeting_id) REFERENCES meetings(id),
    FOREIGN KEY(member_id) REFERENCES members(id)
  );
`);

// Migration: Add start_date and end_date if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(meetings)").all() as any[];
const columnNames = tableInfo.map(c => c.name);

if (!columnNames.includes("start_date")) {
  db.exec("ALTER TABLE meetings ADD COLUMN start_date TEXT;");
}
if (!columnNames.includes("end_date")) {
  db.exec("ALTER TABLE meetings ADD COLUMN end_date TEXT;");
}

// Seed initial members if empty
const membersCount = db.prepare("SELECT COUNT(*) as count FROM members").get() as { count: number };
if (membersCount.count === 0) {
  const insertMember = db.prepare("INSERT INTO members (name, role) VALUES (?, ?)");
  insertMember.run("أحمد محمد", "رئيس اللجنة");
  insertMember.run("سارة علي", "مراقب تقني");
  insertMember.run("خالد عبد الله", "مهندس ميداني");
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  const PORT = 3000;

  // API Routes
  app.get("/api/members", (req, res) => {
    const members = db.prepare("SELECT * FROM members").all();
    res.json(members);
  });

  app.get("/api/meetings", (req, res) => {
    const meetings = db.prepare(`
      SELECT m.*, 
             (SELECT COUNT(*) FROM notes n WHERE n.meeting_id = m.id) as notes_count,
             (SELECT content FROM notes n WHERE n.meeting_id = m.id ORDER BY id ASC LIMIT 1) as first_note
      FROM meetings m 
      ORDER BY date DESC
    `).all();
    res.json(meetings);
  });

  app.post("/api/meetings", (req, res) => {
    const { title, start_date, end_date } = req.body;
    const info = db.prepare("INSERT INTO meetings (title, start_date, end_date) VALUES (?, ?, ?)").run(title, start_date, end_date);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/meetings/:id", (req, res) => {
    const meeting = db.prepare("SELECT * FROM meetings WHERE id = ?").get(req.params.id);
    const notes = db.prepare(`
      SELECT n.*, m.name as member_name, m.role as member_role
      FROM notes n 
      LEFT JOIN members m ON n.member_id = m.id 
      WHERE n.meeting_id = ?
    `).all(req.params.id);
    const attendees = db.prepare(`
      SELECT m.* 
      FROM members m
      JOIN meeting_attendees ma ON m.id = ma.member_id
      WHERE ma.meeting_id = ?
    `).all(req.params.id);
    res.json({ ...meeting, notes, attendees });
  });

  app.patch("/api/meetings/:id", (req, res) => {
    const { title, start_date, end_date } = req.body;
    db.prepare("UPDATE meetings SET title = ?, start_date = ?, end_date = ? WHERE id = ?").run(title, start_date, end_date, req.params.id);
    res.json({ success: true });
  });

  app.post("/api/meetings/:id/attendees/toggle", (req, res) => {
    const { member_id } = req.body;
    const meeting_id = req.params.id;
    
    const existing = db.prepare("SELECT * FROM meeting_attendees WHERE meeting_id = ? AND member_id = ?")
      .get(meeting_id, member_id);
    
    if (existing) {
      db.prepare("DELETE FROM meeting_attendees WHERE meeting_id = ? AND member_id = ?")
        .run(meeting_id, member_id);
    } else {
      db.prepare("INSERT INTO meeting_attendees (meeting_id, member_id) VALUES (?, ?)")
        .run(meeting_id, member_id);
    }
    
    res.json({ success: true });
  });

  app.post("/api/notes", (req, res) => {
    const { meeting_id, member_id, content, type } = req.body;
    const info = db.prepare("INSERT INTO notes (meeting_id, member_id, content, type) VALUES (?, ?, ?, ?)").run(meeting_id, member_id, content, type);
    
    const meeting = db.prepare("SELECT title FROM meetings WHERE id = ?").get(meeting_id) as { title: string };
    broadcast({
      type: 'NEW_NOTE',
      meetingTitle: meeting.title,
      timestamp: new Date().toISOString()
    });

    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/meetings/:id/finalize", (req, res) => {
    db.prepare("UPDATE meetings SET status = 'final' WHERE id = ?").run(req.params.id);
    
    const meeting = db.prepare("SELECT title FROM meetings WHERE id = ?").get(req.params.id) as { title: string };
    broadcast({
      type: 'MEETING_FINALIZED',
      meetingTitle: meeting.title,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true });
  });

  app.patch("/api/notes/:id", (req, res) => {
    const { member_id, type, content } = req.body;
    db.prepare("UPDATE notes SET member_id = ?, type = ?, content = ? WHERE id = ?")
      .run(member_id, type, content, req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
