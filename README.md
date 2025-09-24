# Müllroboter Location Based WebApp für effizientere Müllentsorgung auf dem Tempelhofer Feld

Ioannis Svolos, Matrikelnummer: 906758
Studiengang: Geoinformation Master
Datum der Abgabe: 23.09.2025

Die Müllroboter-WebApp demonstriert ein autonomes System städtischer Müllroboter am Beispiel des Tempelhofer Feldes.
Über eine interaktive Karte werden die Positionen und Routen der Roboter visualisiert.

Nutzer können durch einen Klick auf die Karte ihren Standort festlegen und einen verfügbaren Roboter anfordern. Der Server wählt automatisch den nächstgelegenen freien Roboter aus, berechnet die Route mithilfe der GraphHopper API und simuliert dessen Bewegung bis zum Zielort. 

Die Kommunikation zwischen Server und Clients erfolgt in Echtzeit über Socket.io, sodass Statusänderungen und Bewegungen der Roboter direkt sichtbar sind.

Darüber hinaus bietet die Anwendung ein Info-Panel mit Tabelle, das eine Übersicht aller Roboter, deren Status und Füllstände anzeigt. 

Das Konzept richtet sich speziell an das Tempelhofer Feld. Besucherinnen und Besucher sollen über die App Müllroboter zu ihrem Standort rufen können. Dadurch entfällt der weite Weg zu stationären Mülleimern, was die Müllentsorgung komfortabler und nachhaltiger gestaltet.


## Müllroboter WebApp Video Resultat

https://github.com/user-attachments/assets/c263b52f-7540-4498-8866-c56465b0bde0


# Kurzanleitung zum Starten der Müllroboter WebApp:

1. [ZIP-Datei entpacken](https://github.com/IoannisSvolosBht/MuellroboterWebAppTempelhoferFeld/blob/main/Svolos_906758.zip)
2. Terminal/PowerShell im entpackten Projektordner öffnen.
3. Befehl ausführen und Abhängigkeiten installieren:
   
        npm install
4. Datenbank initialisieren:
   
        npm run init-db

5. GraphHopper API-Key setzen:
   
        set GRAPH_HOPPER_KEY=dein_api_key
   
   Wenn man einen eigenen GraphHopper Key hat, kann man diesen hier als Umgebungsvariable festlegen. (Ansonsten diesen Schritt überspringen und meinen persönlichen API Key verwenden)

6. Server starten:
   
   Im Terminal: ``` node server.js ```

7. WebApp im Browser öffnen:
   
   Browser öffnen: ``` http://localhost:3000 ```



# Standorte
## a) Müllroboter
Auf der interaktiven Karte werden alle Roboter als Marker angezeigt:
- Grün (idle) → verfügbar
- Rot (busy) → besetzt
- Blau (myActive) → aktuell für den Nutzer unterwegs.

<img width="1914" height="923" alt="Screenshot (15)" src="https://github.com/user-attachments/assets/90c85af7-4e85-460a-8cd1-92f7a35133e1" />

<img width="336" height="374" alt="Screenshot (15) - Kopie" src="https://github.com/user-attachments/assets/eac654fc-b065-4b8c-bcfd-7ef943dad7a7" />

## b) Nutzer
Da die automatische Geolokalisierung im Firefox-Browser ungenau sein kann, wird der Standort des Nutzers manuell mit einem Marker auf der Karte gesetzt:

<img width="234" height="215" alt="Screenshot (22) - Kopie" src="https://github.com/user-attachments/assets/7b4c6f58-2f10-4c87-b8da-a6e8d0d5347b" />



# Echtzeitliste 
In dieser Tabelle werden alle Müllroboter angezeigt, inklusive ihres aktuellen Status: ob sie momentan besetzt, verfügbar oder gerade vom Nutzer gerufen wurden.

<img width="563" height="312" alt="Screenshot (19) - Kopie" src="https://github.com/user-attachments/assets/177c4cf7-305d-4a14-ab4e-edcb79d9fef2" />


# Routing 
Um einen Roboter zu rufen, klickt der Nutzer auf den Button in der rechten oberen Box. Anschließend wird automatisch der nächstgelegene verfügbare Roboter ausgewählt. Roboter, die aktuell besetzt sind, werden dabei ignoriert. Die Berechnung der Route erfolgt mit Unterstützung der GraphHopper API.

