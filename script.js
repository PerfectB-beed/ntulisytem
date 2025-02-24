const SHEET_URL = "https://docs.google.com/spreadsheets/d/1AsIKhCvWQZhtvnemBdNmr2Mq7Fd6y1SZtgxHgviGTYQ/gviz/tq?tqx=out:json";

const UPDATE_URL = "https://script.google.com/macros/s/AKfycbyprFLBIDfXhKLEG_lExmkQrPaCF-GXYbpwamKL6wrrUyCzSjbenK8cJRp2obC33zjw/exec"; // Replace with your Google Apps Script URL

let db;

// ✅ 1. Open IndexedDB

const request = indexedDB.open("PlayerDB", 1);

request.onupgradeneeded = function(event) {

    db = event.target.result;

    let store = db.createObjectStore("players", { keyPath: "playerID" });

    store.createIndex("team", "team", { unique: false });

};

request.onsuccess = function(event) {

    db = event.target.result;

    checkConnection();

    populateTeamFilter();

};

request.onerror = function() {

    console.error("IndexedDB failed to open");

};

// ✅ 2. Save players to IndexedDB

function savePlayersToDB(players) {

    let transaction = db.transaction(["players"], "readwrite");

    let store = transaction.objectStore("players");

    players.forEach(player => store.put(player));

}

// ✅ 3. Get player by ID from IndexedDB

function getPlayerFromDB(playerID, callback) {

    let transaction = db.transaction(["players"], "readonly");

    let store = transaction.objectStore("players");

    let request = store.get(playerID);

    request.onsuccess = () => callback(request.result);

}

// ✅ 4. Get players by team from IndexedDB

function getPlayersByTeam(team, callback) {

    let transaction = db.transaction(["players"], "readonly");

    let store = transaction.objectStore("players");

    let index = store.index("team");

    let request = index.getAll(team);

    request.onsuccess = () => callback(request.result);

}

// ✅ 5. Populate team dropdown

function populateTeamFilter() {

    let transaction = db.transaction(["players"], "readonly");

    let store = transaction.objectStore("players");

    let request = store.getAll();

    request.onsuccess = function() {

        let teams = [...new Set(request.result.map(player => player.team))];

        let teamSelect = document.getElementById("teamFilter");

        teamSelect.innerHTML = '<option value="">Select Team</option>';

        teams.forEach(team => {

            let option = document.createElement("option");

            option.value = team;

            option.textContent = team;

            teamSelect.appendChild(option);

        });

    };

}

// ✅ 6. Fetch data from Google Sheets

async function fetchData() {

    try {

        const response = await fetch(SHEET_URL);

        const text = await response.text();

        const json = JSON.parse(text.substring(47, text.length - 2));

        let players = json.table.rows.map(row => ({

            playerID: row.c[5]?.v || "",

            team: row.c[0]?.v || "",

            name: row.c[1]?.v || "",

            surname: row.c[2]?.v || "",

            dob: row.c[3]?.v || "",

            image: row.c[4]?.v || "",

            status: row.c[6]?.v || ""

        }));

        savePlayersToDB(players);

        populateTeamFilter();

    } catch (error) {

        console.error("Error fetching data:", error);

    }

}

// ✅ 7. Search for a player

function searchPlayer() {

    const playerID = document.getElementById("searchID").value;

    if (navigator.onLine) {

        fetchData().then(() => getPlayerFromDB(playerID, displayPlayer));

    } else {

        getPlayerFromDB(playerID, displayPlayer);

    }

}

// ✅ 8. Display player details with status dropdown

function displayPlayer(player) {

    document.getElementById("playerDetails").innerHTML = player ? `

        <div class="player-box">

            <img src="${player.image}" alt="Player Image" class="player-image">

            <div class="player-info">

                <p><strong>Team:</strong> ${player.team}</p>

                <p><strong>Name:</strong> ${player.name} ${player.surname}</p>

                <p><strong>Date of Birth:</strong> ${player.dob}</p>

                <p><strong>Status:</strong> ${player.status}</p>

                <label for="statusSelect">Update Status:</label>

                <select id="statusSelect">

                    <option value="Clear" ${player.status === "Clear" ? "selected" : ""}>Clear</option>

                    <option value="Red Carded" ${player.status === "Red Carded" ? "selected" : ""}>Red Carded</option>

                </select>

                <button onclick="updatePlayerStatus('${player.playerID}')">Update</button>

            </div>

        </div>` : "<p>Player not found.</p>";

}

// ✅ 9. Update player status

function updatePlayerStatus(playerID) {

    const newStatus = document.getElementById("statusSelect").value;

    let transaction = db.transaction(["players"], "readwrite");

    let store = transaction.objectStore("players");

    let request = store.get(playerID);

    request.onsuccess = function() {

        let player = request.result;

        if (player) {

            player.status = newStatus;

            store.put(player); // Update IndexedDB

            syncStatusWithGoogleSheets(playerID, newStatus);

            alert("Player status updated successfully!");

            displayPlayer(player);

        }

    };

}

// ✅ 10. Sync status update with Google Sheets

function syncStatusWithGoogleSheets(playerID, newStatus) {

    if (!navigator.onLine) {

        console.log("Offline mode: Status update will sync later.");

        return;

    }

    fetch(UPDATE_URL, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ playerID, status: newStatus })

    })

    .then(response => response.json())

    .then(data => console.log("Google Sheets updated:", data))

    .catch(error => console.error("Error updating Google Sheets:", error));

}

// ✅ 11. Filter players by team

function filterByTeam() {

    const team = document.getElementById("teamFilter").value;

    getPlayersByTeam(team, displayPlayers);

}

// ✅ 12. Display team players with total count

function displayPlayers(players) {

    let output = players.length ? `<h2>Team Players</h2>

    <p>Total Players: <strong>${players.length}</strong></p>

    <div class='player-grid'>` : "<p>No players found.</p>";

    players.forEach(player => {

        output += `

        <div class="player-box">

            <img src="${player.image}" alt="Player Image" class="player-image">

            <div class="player-info">

                <p><strong>${player.name} ${player.surname}</strong></p>

                <p>Status: ${player.status}</p>

            </div>

        </div>`;

    });

    document.getElementById("playerDetails").innerHTML = output + (players.length ? "</div>" : "");

}

// ✅ 13. Monitor connection status

window.addEventListener("load", () => {

    checkConnection();

    if (navigator.onLine) fetchData();

});

window.addEventListener("online", () => {

    document.getElementById("status").textContent = "Online - Fetching latest data...";

    fetchData();

});

window.addEventListener("offline", () => {

    document.getElementById("status").textContent = "Offline - Using cached data";

});

// ✅ 14. Update status display

function checkConnection() {

    document.getElementById("status").textContent = navigator.onLine ? "Online" : "Offline";

}