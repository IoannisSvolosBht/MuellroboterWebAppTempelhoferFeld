// Leaflet Karte
const map = L.map('map').setView([52.4750, 13.4005], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:19,
  attribution:'© OpenStreetMap contributors'
}).addTo(map);

// Socket.io
const socket = io();

// Icons für Müllroboter
function getRobotIcon(status){
  let url;
  switch(status){
    case 'idle': url='https://cdn3.iconfinder.com/data/icons/social-messaging-ui-color-line/254000/171-512.png'; break;
    case 'busy': url='https://cdn3.iconfinder.com/data/icons/social-messaging-ui-color-line/254000/82-512.png'; break;
    case 'myActive': url='https://cdn3.iconfinder.com/data/icons/social-messaging-ui-color-line/254000/38-512.png'; break;
    default: url='https://cdn3.iconfinder.com/data/icons/social-messaging-ui-color-line/254000/171-512.png';
  }
  return L.icon({iconUrl:url, iconSize:[24,24]});
}

// LayerGroups & Marker
const robotsLayer = L.layerGroup().addTo(map);
const robotMarkers = {};
let selectedRobot = null;
const activeIntervals = {};

// Panels
const tableDiv = document.getElementById('tablePanel');
const impressumDiv = document.getElementById('impressumPanel');
const robotInfoDiv = document.getElementById('robotInfo');
const routeInfoDiv = document.getElementById('routeInfo');
const callRobotBtn = document.getElementById('callRobotBtn');
const tableIcon = document.getElementById('tableIcon');
const impressumIcon = document.getElementById('impressumIcon');

// Tabellen / Impressum Toggle
tableIcon.addEventListener('click', ()=>{
  tableDiv.style.display = tableDiv.style.display==='none'?'block':'none';
  impressumDiv.style.display = 'none';
  updateRobotTable();
});
impressumIcon.addEventListener('click', ()=>{
  impressumDiv.style.display = impressumDiv.style.display==='none'?'block':'none';
  tableDiv.style.display = 'none';
});

// Status
function translateStatus(status){
  switch(status){ 
    case 'idle': return 'Verfügbar'; 
    case 'busy': return 'Besetzt'; 
    case 'myActive': return 'Mein aktiver'; 
    default: return status; 
  }
}
function statusColor(status){
  switch(status){ 
    case 'idle': return 'limegreen'; 
    case 'busy': return 'tomato'; 
    case 'myActive': return 'dodgerblue'; 
    default: return 'white'; 
  }
}

// Tabelle updaten
function updateRobotTable(){
  const arr = Object.values(robotMarkers);
  arr.sort((a,b)=>({'myActive':0,'busy':1,'idle':2}[a.options.status]-{'myActive':0,'busy':1,'idle':2}[b.options.status]));
  tableDiv.innerHTML = `<table style="width:100%;border-collapse:collapse;text-align:left;">
    <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.3);">
      <th style="padding:6px;">Müllroboter</th>
      <th style="padding:6px;">Status</th>
      <th style="padding:6px;">Füllstand</th>
      <th style="padding:6px;">Position</th>
    </tr></thead>
    <tbody>
      ${arr.map(m=>{
        const latLng = m.getLatLng();
        return `<tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
          <td style="padding:6px;">Müllroboter ${m.options.robotId||m._leaflet_id}</td>
          <td style="padding:6px;color:${statusColor(m.options.status)};">${translateStatus(m.options.status)}</td>
          <td style="padding:6px;">${m.options.fill||0}%</td>
          <td style="padding:6px;font-size:10px;">${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)}</td>
        </tr>`
      }).join('')}
    </tbody>
  </table>`;
}

// Roboter hinzufügen / updaten
function addOrUpdateRobot(r){
  if(!robotMarkers[r.id]){
    const m = L.marker([r.lat,r.lng],{icon:getRobotIcon(r.status)});
    m.options.status = r.status;
    m.options.fill = r.fill||0;
    m.options.robotId = r.id;
    m.bindPopup(`Müllroboter ${r.id}<br>Status: ${translateStatus(r.status)}<br>Füllstand: ${m.options.fill}%<br>Position: ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`);
    
    
    if(r.status !== 'idle') {
      m.setOpacity(0.6);
    }
    
    robotMarkers[r.id] = m;
    robotsLayer.addLayer(m);
  } else {
    const m = robotMarkers[r.id];
    m.setLatLng([r.lat,r.lng]);
    m.options.status = r.status;
    m.options.fill = r.fill||0;
    m.setIcon(getRobotIcon(r.status));
    m.setPopupContent(`Müllroboter ${r.id}<br>Status: ${translateStatus(r.status)}<br>Füllstand: ${m.options.fill}%<br>Position: ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`);
    
   
    if(r.status !== 'idle') {
      m.setOpacity(0.6);
    } else if(selectedRobot && selectedRobot.options.robotId === r.id) {
      m.setOpacity(1.0);
    } else {
      m.setOpacity(0.6);
    }
  }
  if(tableDiv.style.display==='block') updateRobotTable();
}


function moveRobotAlongRoute(robotId, coords, isMyActive=false){
  if(activeIntervals[robotId]) clearInterval(activeIntervals[robotId]);
  let step=0;
  const interval = setInterval(()=>{
    if(step >= coords.length){
      clearInterval(interval);
      delete activeIntervals[robotId];
      return;
    }
    const [lat,lng] = coords[step];
    const status = isMyActive ? 'myActive' : 'busy';
    addOrUpdateRobot({id:robotId, lat, lng, status, fill:Math.floor(Math.random()*100)});
    step++;
  }, 1000);
  activeIntervals[robotId] = interval;
}

// Nutzer-Marker
const userIcon = L.divIcon({className:"custom-user-marker", html:`<div class="pulse"></div>`, iconSize:[20,20], iconAnchor:[10,10]});
let userMarker=null;

map.on('click', e => {
  const {lat, lng} = e.latlng;
  if(!userMarker){
    userMarker = L.marker([lat, lng], {icon: userIcon}).addTo(map).bindPopup("Dein Standort").openPopup();
  } else {
    userMarker.setLatLng([lat, lng]).openPopup();
  }

  // Nur verfügbare (grüne/idle) Roboter berücksichtigen
  const availableMarkers = Object.values(robotMarkers).filter(m => m.options.status === 'idle');
  
  if(availableMarkers.length === 0) {
    Object.values(robotMarkers).forEach(m => m.setOpacity(1.0));
    selectedRobot = null;
    callRobotBtn.disabled = true;
    alert("Keine verfügbaren Roboter!");
    return;
  }

 
  Object.values(robotMarkers).forEach(m => m.setOpacity(0.6));
  
  // Nächsten verfügbaren Roboter finden
  let nearest = availableMarkers[0];
  let minDist = map.distance([lat, lng], nearest.getLatLng());
  
  availableMarkers.forEach(m => {
    const d = map.distance([lat, lng], m.getLatLng());
    if(d < minDist) {
      minDist = d;
      nearest = m;
    }
  });
  
  // Nur den ausgewählten verfügbaren Roboter hervorheben
  nearest.setOpacity(1.0);
  selectedRobot = nearest;
  callRobotBtn.disabled = false;
});

function markSelectedRobot(robotId){
  Object.values(robotMarkers).forEach(m => {
    if(m.options.robotId === robotId) {
      m.options.status = 'myActive';
    } else if(m.options.status === 'myActive') {
      m.options.status = 'idle';
    }
    m.setIcon(getRobotIcon(m.options.status));
    m.setOpacity(1.0); 
  });
  
  if(tableDiv.style.display === 'block') updateRobotTable();
}

// Müllroboter rufen 
callRobotBtn.addEventListener('click', ()=>{
  if(!selectedRobot || !userMarker || selectedRobot.options.status !== 'idle') {
    // Sicherstellen, dass nur verfügbare Roboter gerufen werden können
    callRobotBtn.disabled = true;
    alert("Kein verfügbarer Roboter ausgewählt!");
    return;
  }
  
  const {lat, lng} = userMarker.getLatLng();
  const selectedRobotId = selectedRobot.options.robotId;
  
  markSelectedRobot(selectedRobotId);
  callRobotBtn.disabled = true;

  fetch('/api/requestRobot', {
    method: 'POST',
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({lat, lng})
  }).then(res => res.json()).then(data => {
    if(data.error) {
      alert("Fehler: " + data.error);
      if(selectedRobot) {
        selectedRobot.options.status = 'idle';
        selectedRobot.setIcon(getRobotIcon('idle'));
      }
      return;
    }
    
    if(window.routeLayer) map.removeLayer(window.routeLayer);
    window.routeLayer = L.geoJSON(data.route, {style: {color: 'blue', weight: 4}}).addTo(map);
    map.fitBounds(window.routeLayer.getBounds());
    robotInfoDiv.innerHTML = `Müllroboter: ${data.robot.id}<br>Füllstand: ${data.robot.fill || 0}%`;
    routeInfoDiv.innerHTML = `Distanz: ${Math.round(data.distance || 0)} m<br>Dauer: ${Math.round(data.duration || 0)} s`;

    // Bewegung starten
    const coords = data.route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    moveRobotAlongRoute(data.robot.id, coords, true);
  }).catch(error => {
    console.error('Fehler beim Roboter-Ruf:', error);
    alert('Fehler beim Aufrufen des Roboters');
  });
});

// Socket Events
socket.on('initial_robots', robots=>{
  robots.forEach((r,i)=>{
    addOrUpdateRobot(r);
  });
});

socket.on('robotUpdate', r=>{
  addOrUpdateRobot(r);
});

socket.on('robotStatusChange', r=>{
  addOrUpdateRobot(r);
});

socket.on('robotArrived', r=>{ 
  addOrUpdateRobot(r); 
  alert(`Müllroboter ${r.id} ist angekommen`); 
  
  
  if(window.routeLayer) {
    map.removeLayer(window.routeLayer);
    window.routeLayer = null;
  }
  robotInfoDiv.innerHTML = '';
  routeInfoDiv.innerHTML = '';
  callRobotBtn.disabled = true;
});


setTimeout(() => {
  if(Object.keys(robotMarkers).length === 0) {
    for(let i=1; i<=15; i++) {
      const status = (i % 3 === 0) ? 'busy' : 'idle';
      addOrUpdateRobot({
        id: i,
        lat: 52.4745 + Math.random()*0.004,
        lng: 13.3980 + Math.random()*0.005,
        status: status,
        fill: Math.floor(30 + Math.random()*70)
      });
    }
  }
}, 5000);