const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("data.db");

db.serialize(() => {
  db.run("DROP TABLE IF EXISTS robots");
  db.run("DROP TABLE IF EXISTS bins");

  db.run(`CREATE TABLE robots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL,
    lng REAL,
    status TEXT DEFAULT 'idle',
    fill INTEGER DEFAULT 50
  )`);

  db.run(`CREATE TABLE bins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL,
    lng REAL,
    fill INTEGER
  )`);

  // 15 Roboter einige als busy, einige als idle
  const robots = [];
  for(let i=0; i<15; i++){
    // Jeder 3. Roboter startet als busy (rot), restliche als idle (grün)
    const status = (i % 3 === 0) ? 'busy' : 'idle';
    robots.push([
      52.4745 + Math.random()*0.004, 
      13.3980 + Math.random()*0.005, 
      status,
      Math.floor(30 + Math.random()*70)
    ]);
  }

  const bins = [
    [52.475, 13.402, 30],
    [52.476, 13.404, 80],
    [52.474, 13.399, 55],
  ];

  const insRobot = db.prepare("INSERT INTO robots (lat,lng,status,fill) VALUES (?,?,?,?)");
  robots.forEach(r => insRobot.run(r));
  insRobot.finalize();

  const insBin = db.prepare("INSERT INTO bins (lat,lng,fill) VALUES (?,?,?)");
  bins.forEach(b => insBin.run(b));
  insBin.finalize();

  console.log("Roboter in Datenbank:");
  robots.forEach((r, i) => {
    console.log(`Roboter ${i+1}: Status = ${r[2]}`);
  });
});

db.close(()=>console.log("DB mit 15 Robotern (inkl. busy Roboter) initialisiert"));