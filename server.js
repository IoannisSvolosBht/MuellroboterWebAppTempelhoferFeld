const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const GRAPH_HOPPER_KEY = process.env.GRAPH_HOPPER_KEY || "c51f0e9b-cd4d-4724-82e0-4e54e84fbf23";

const app = express();
app.use(express.json());
app.use('/', express.static(path.join(__dirname,'public')));

const db = new sqlite3.Database('./data.db');
const server = http.createServer(app);
const io = new Server(server);

const activeIntervals = {};

// Roboter abrufen
app.get('/api/robots', (req,res)=>{
  db.all("SELECT * FROM robots",(err,rows)=>{
    if(err) return res.status(500).json({error:err.message});
    res.json(rows);
  });
});

// Roboter rufen (nur idle)
app.post('/api/requestRobot', async (req,res)=>{
  const {lat,lng} = req.body;
  console.log("Roboter-Anfrage für Position:", lat, lng);
  
  db.all("SELECT * FROM robots",(err,robots)=>{
    if(err) return res.status(500).json({error:err.message});

    // Nur idle-Roboter berücksichtigen
    const freeRobots = robots.filter(r => r.status === 'idle');
    console.log("Verfügbare Roboter:", freeRobots.length);
    
    if(freeRobots.length === 0) return res.status(400).json({error:'Kein Roboter verfügbar'});

    // Nächsten freien Roboter auswählen
    freeRobots.forEach(r => r.dist = Math.hypot(r.lat-lat, r.lng-lng));
    freeRobots.sort((a,b) => a.dist - b.dist);
    const robot = freeRobots[0];
    
    console.log(`Ausgewählter Roboter ${robot.id}`);

    // Status auf myActive setzen
    setRobotStatus(robot.id, 'myActive');

    getRouteGraphHopper(robot, {lat,lng})
      .then(routeGeoJSON => {
        const routeLatLng = routeGeoJSON.geometry.coordinates.map(([lng,lat])=>[lat,lng]);
        console.log(`Route mit ${routeLatLng.length} Punkten generiert`);
        
        moveRobotAlongRoute(robot.id, routeLatLng, true, robot);

        res.json({
          robot,
          route: routeGeoJSON,
          distance: routeGeoJSON.properties.distance,
          duration: routeGeoJSON.properties.duration
        });
      })
      .catch(e => {
        console.error("GraphHopper Fehler:", e);
        res.status(500).json({error:e.message});
      });
  });
});

// Status setzen & emit Socket
function setRobotStatus(robotId,status){
  db.run("UPDATE robots SET status=? WHERE id=?",[status,robotId], function(err) {
    if(err) {
      console.error("DB Fehler beim Status-Update:", err);
    }
  });
  
  // Roboter-Daten sofort abrufen und senden
  db.get("SELECT * FROM robots WHERE id=?",[robotId],(err,row)=>{
    if(err) {
      console.error("Fehler beim Abrufen des Roboters:", err);
    } else if(row) {
      io.emit("robotStatusChange", row);
    }
  });
}

// GraphHopper Fußgänger-Route
async function getRouteGraphHopper(from,to){
  const url = `https://graphhopper.com/api/1/route?point=${from.lat},${from.lng}&point=${to.lat},${to.lng}&vehicle=foot&locale=de&points_encoded=false&key=${GRAPH_HOPPER_KEY}`;
  const resp = await fetch(url);
  if(!resp.ok) throw new Error(`GraphHopper Fehler: ${resp.status}`);
  const data = await resp.json();
  if(!data.paths || data.paths.length===0) throw new Error("Keine Route erhalten");
  const path = data.paths[0];
  return {
    type:"Feature",
    geometry:{type:"LineString", coordinates:path.points.coordinates},
    properties:{distance:path.distance, duration:path.time/1000}
  };
}

// Roboter entlang Route bewegen
function moveRobotAlongRoute(robotId, coords, isMyActive=false, originalRobot=null){
  if(activeIntervals[robotId]) {
    clearInterval(activeIntervals[robotId]);
  }
  
  let step=0;
  const interval = setInterval(()=>{
    if(step >= coords.length){
      clearInterval(interval);
      delete activeIntervals[robotId];
      
      if(isMyActive){
        
        const finalCoords = coords[coords.length-1];
        console.log(`Roboter ${robotId} angekommen`);
        
        db.run("UPDATE robots SET lat=?, lng=?, status='idle' WHERE id=?", 
          [finalCoords[0], finalCoords[1], robotId], function(err) {
            if(err) {
              console.error("Fehler beim finalen Standort-Update:", err);
            } else {
              // Die Aktualisierten Roboter an alle Clients senden
              db.get("SELECT * FROM robots WHERE id=?", [robotId], (err, row) => {
                if(err) {
                  console.error("Fehler beim Abrufen des finalen Roboters:", err);
                } else if(row) {
                  io.emit("robotArrived", row);
                  io.emit("robotStatusChange", row);
                }
              });
            }
          });
      }
      return;
    }
    
    const [lat,lng] = coords[step];
    const status = isMyActive ? 'myActive' : 'busy';
    
    // Position während der Fahrt in DB aktualisieren
    db.run("UPDATE robots SET lat=?, lng=? WHERE id=?", [lat, lng, robotId]);
    
    io.emit("robotUpdate", {id:robotId, lat, lng, status});
    step++;
  }, 1000);
  activeIntervals[robotId] = interval;
}

// Bewegung für busy Roboter simulieren
function simulateBusyRobots() {
  db.all("SELECT * FROM robots WHERE status='busy'", (err, busyRobots) => {
    if(err) {
      console.error("Fehler beim Abrufen busy Roboter:", err);
      return;
    }
    
    busyRobots.forEach(robot => {
      // Zufällige Route um den Roboter herum generieren
      const baseLat = robot.lat;
      const baseLng = robot.lng;
      const route = [];
      for(let i=0; i<5; i++) {
        route.push([
          baseLat + (Math.random() - 0.5) * 0.001,
          baseLng + (Math.random() - 0.5) * 0.001
        ]);
      }
      // Zurück zum Startpunkt
      route.push([baseLat, baseLng]);
      moveRobotAlongRoute(robot.id, route, false);
    });
  });
}

// Socket Verbindung
io.on('connection', socket=>{
  console.log("Socket verbunden", socket.id);
  db.all("SELECT * FROM robots",(err,rows)=>{
    if(err) {
      console.error("Datenbank-Fehler:", err);
      return;
    }
    socket.emit("initial_robots", rows);
  });
});

// Busy Roboter Bewegung starten
setTimeout(simulateBusyRobots, 2000);

server.listen(3000,()=>console.log("Server läuft auf http://localhost:3000"));