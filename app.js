// API_URL: The web address where we send requests to get or send data
// This is a Google Apps Script URL that handles our backend logic
const API_URL =
    "https://script.google.com/macros/s/AKfycbxzoS5ztPFjpq1LJFgTYGNPVgj61NEk1StDmDw3mV6uebbbiY1J4XW0WnMxD6YEQz2V/exec";

/* ============================================================
   API - Functions for communicating with the server
============================================================ */

// api() - Sends a request to the server and gets back data
// Parameters:
//   - action: What we want the server to do (like "member" or "admin_login")
//   - params: Additional information we want to send (like citizenship_id)
// Returns: The data from the server as a JavaScript object
async function api(action, params = {}) {

    // Create URLSearchParams: This converts our data into the format needed for the web request
    // It takes the action and all the params and puts them in the URL
    const query =
        new URLSearchParams({
            action: action,  // Include the action name
            ...params         // Include all other parameters (the "..." spreads them out)
        });


    // Send the request to the API URL with our query parameters
    // "await" means: wait for the server to respond before continuing
    // "fetch" is a function that sends HTTP requests
    const response =
        await fetch(
            `${API_URL}?${query.toString()}`  // Combine URL with query string
        );


    // Get the response text - this is the data the server sent back
    // "await" means: wait for the server's response to be converted to text
    const text =
        await response.text();


    // Log (print) information about what happened - useful for debugging
    // This shows: the API action, the response status code (200 = success, etc.), and the data
    console.log(
        "API:",
        action,
        response.status,  // HTTP status code (200 = OK, 400 = bad request, etc.)
        text               // The actual response data
    );


    // Check if the response is empty (bad response from server)
    // .trim() removes spaces from the beginning and end
    // The "!" means "not" - so this says: if text is empty, throw an error
    if (!text.trim()) {

        throw new Error(
            "Google Apps Script returned an empty response."
        );
    }


    // Try to convert the text to a JavaScript object (JSON parsing)
    try {

        // JSON.parse() converts a text string into a JavaScript object we can use
        return JSON.parse(text);

    } catch (error) {

        // If parsing fails, the server didn't send proper JSON format
        throw new Error(
            "Google Apps Script did not return JSON:\n" +
            text.substring(0, 500)  // Show first 500 characters of the bad response
        );
    }
}


/* ============================================================
   LOCAL STORAGE - Save and load data on the user's computer
============================================================ */

// getSavedID() - Retrieves the citizenship ID that was saved on this computer
// Returns: The saved citizenship ID, or null if nothing was saved
function getSavedID() {

    // localStorage is like a small filing cabinet on the user's computer
    // .getItem() retrieves a saved value by name
    return localStorage.getItem(
        "citizenship_id"  // The name of the saved value
    );
}


function getCachedReportData() {

    const cached =
        localStorage.getItem("report_data");

    if (!cached) {
        return null;
    }

    try {
        return JSON.parse(cached);
    } catch (error) {
        localStorage.removeItem("report_data");
        return null;
    }
}


function saveCachedReportData(data) {

    localStorage.setItem(
        "report_data",
        JSON.stringify(data)
    );
}


function clearCachedReportData() {

    localStorage.removeItem(
        "report_data"
    );
}

function getCachedMember(id){
    const cached = localStorage.getItem(
        "member_data_" + id
    );

    if (!cached) {
        return null;
    }

    try {
        return JSON.parse(cached);
    } catch (error) {
        localStorage.removeItem(
            "member_data_" + id
        );
        return null;
    }
}

function saveCachedMember(id, data) {
    localStorage.setItem(
        "member_data_" + id,
        JSON.stringify(data)
    );
}

function clearCachedMember(id){
    localStorage.removeItem(
        "member_data_" + id
    );
}

let memberRefreshInProgress = false;

// saveID() - Saves a citizenship ID on this computer so we remember it next time
// Parameter: id - The citizenship ID to save
function saveID(id) {

    // localStorage.setItem() saves a value with a name
    // Next time the user visits, we can retrieve it with getSavedID()
    localStorage.setItem(
        "citizenship_id",  // The name to save it under
        id                 // The value to save
    );
}


// clearID() - Removes the saved citizenship ID from this computer
// This is used when logging out
function clearID() {

    // localStorage.removeItem() deletes a saved value
    localStorage.removeItem(
        "citizenship_id"  // The name of the value to delete
    );
}


/* ============================================================
   HTML - Functions to update what the user sees on screen
============================================================ */

// setContent() - Updates the main content area of the page with new HTML
// Parameter: html - The HTML code to display (what the user will see)
function setContent(html) {

    // Find the element with id="content" (the main content container)
    // .innerHTML replaces everything inside it with the new html
    document
        .getElementById("content")
        .innerHTML = html;  // The new content to display
}


function updateActivityLog(events) {
    const activityLog =
        document.querySelector(".activity-log");

    if (!activityLog) {
        return;
    }

    const reversedEvents =
        [...(events || [])].reverse();

    if (!reversedEvents.length) {
        activityLog.innerHTML =
            `<div class="empty-state">
                No reports yet.
            </div>`;
        return;
    }

    activityLog.innerHTML =
        reversedEvents.map(event => `
            <div class="activity-item">
                <div>
                    <strong>${event.reason || "Report"}</strong>
                    <div class="activity-date">
                        ${event.timestamp || ""}
                    </div>
                </div>

                <div class="activity-points">
                    ${event.points > 0 ? "+" : ""}
                    ${event.points || 0}
                </div>
            </div>
        `).join("");
}

async function refreshMember(id) {
    try {
        const result = await api("member_basic", {
            citizenship_id: id
        });

        if (!result.success) {
            if (getSavedID() === id) {
                clearID();
                clearCachedMember(id);
                showLogin();
            }

            return;
        }

        // Stop if the user has changed account while the request was running.
        if (getSavedID() !== id) {
            return;
        }

        const cached = getCachedMember(id);

        const merged = {
            ...result,
            events: cached?.events || []
        };

        saveCachedMember(id, merged);

        renderMember(merged);

        // Load the latest events separately.
        await loadMemberEvents(id);

    } catch (error) {
        console.error(
            "Background member refresh failed:",
            error
        );
    }
}


async function loadMemberEvents(id) {
    try {
        const result = await api("member_events", {
            citizenship_id: id
        });

        if (!result.success) {
            console.error("Could not load member events:", result.error);
            return;
        }

        // Don't update the page if the user has changed accounts
        if (getSavedID() !== id) {
            return;
        }

        const cached = getCachedMember(id);

        if (!cached) {
            return;
        }

        cached.events = result.events || [];

        saveCachedMember(id, cached);

        updateActivityLog(cached.events);

    } catch (error) {
        console.error(
            "Could not load member events:",
            error
        );
    }
}

/* ============================================================
   START - The first function that runs when the page loads
============================================================ */

// start() - Checks if the user is already logged in, and shows the right screen
// If logged in: shows their member dashboard
// If not logged in: shows the login screen
async function start() {

    // Get the saved citizenship ID from the computer
    const id =
        getSavedID();

    if (!id) {
        showLogin();
        return;
    }

    const cached = getCachedMember(id);

    if (cached && cached.person) {
        renderMember(cached);
        refreshMember(id);
    } else {
        await showMember(id);
    }
}


/* ============================================================
   MEMBER LOGIN - The login screen
============================================================ */

// showLogin() - Displays the login screen where users enter their citizenship ID
// Also shows the admin login button
function showLogin() {

    // Create the login form HTML and display it
    setContent(`


        <div class="login-screen">


            <div class = "card login-card">
                <div class = "classified">
                    AUTHORIZED CITIZENS ONLY
                </div>

                <h2>
                    Citizenship Identification
                </h2>


                <input 
                    id="citizenship-input"
                    placeholder = "ENTER CITIZENSHIP ID"
                >

                <button id = "login-button">
                    VERIFY IDENTITY
                </button>

                <p
                    id = "login-error"
                    class = "error"
                ></p>
            
            </div>

            <button
                id = "admin-button"
                class = "admin-link"
            >
                ADMINISTRATIVE ACCESS
            </button>
        
        </div>
    `);

    // Set up event handlers (what to do when buttons are clicked)
    // .onclick = means "when this button is clicked, run this function"
    document
        .getElementById("login-button")
        .onclick = login;  // Click the ENTER button -> run login() function


    document
        .getElementById("admin-button")
        .onclick = showAdminLogin;  // Click ADMIN MODE button -> run showAdminLogin() function
}



// login() - Called when the user clicks the ENTER button
// This function validates the ID and tries to log the user in
async function login() {

    const input = 
        document.getElementById("citizenship-input");

    const button = document.getElementById("login-button");

    const error = document.getElementById("login-error");

    // Get the citizenship ID from the input field and remove extra spaces
    const id =
        input
            .value  // Get what the user typed
            .trim();  // Remove spaces from beginning and end


    // Check if the ID field is empty
    if (!id) {

        // Show an error message
        error
            .innerText =
                "Enter your citizenship ID.";

        return; 
    }


    error.innerText = "VERIFYING CITIZEN...";

    button.disabled = true;


    // Try to log in 
    try {

        // Send the citizenship ID to the server
        // The server will check if this ID exists and send back the user's info
        const result =
            await api(
                "member_basic",  // The action we want: get member info
                {
                    citizenship_id: id  // Send the ID
                }
            );


        // Check if the login was successful
        if (!result.success) {

            button.disabled = false;
            error.innerText = result.error;
            return;
        }


        // Save the ID so we remember the user next time
        saveID(id);

        const cached = getCachedMember(id);

        const merged = {
          ...result,
          events: cached?.events ||[]
        };

        saveCachedMember(id, merged);

        // Display the member's profile with their data
        renderMember(merged);

        await loadMemberEvents(id);

    } catch (error) {
        button.disabled = false;
        // Something went wrong (network error, server error, etc.)
        // Show the login screen again
        showLogin();

        // Display what went wrong
        document
            .getElementById(
                "login-error"
            )
            .innerText =
                error.message;  // The error message
    }
}


/* ============================================================
   MEMBER
============================================================ */

async function showMember(id) {

    const cached = getCachedMember(id);

    if (cached && cached.person){
        renderMember(cached);
        refreshMember(id);
        return;
    }

    // Show loading message while we wait for the server
    setContent(`
        <div class="card">
            VERIFYING CITIZEN...
        </div>
    `);


    try {

        // Ask the server for this member's information
        const result =
            await api(
                "member_basic",  // Get member data
                {
                    citizenship_id: id  // For this specific ID
                }
            );


        // Check if the request was successful
        if (!result.success) {

            // Something went wrong (maybe the ID is no longer valid)
            // Clear the saved ID and show login screen
            clearID();
            clearCachedMember(id);

            showLogin();

            return;  // Stop here
        }

        const cached = getCachedMember(id);

        const member = {
          ...result,
          events: cached?.events || []
        };

        saveCachedMember(id, member);


        // Success! Show the member's profile with the data from the server
        renderMember(member);

        loadMemberEvents(id);

    } catch (error) {

        // Network error or something went wrong
        // Show the error message to the user
        setContent(`
            <div class="card error">
                ${escapeHTML(error.message)}
            </div>
        `);
    }
}

const PEOPLE_SHEET = "People";
const EVENTS_SHEET = "Events";
const REASONS_SHEET = "Reasons";
const CONFIG_SHEET = "Config";
const ADJUSTMENTS_SHEET = "Adjustments";
const QUEUE_SHEET = "AdjustmentQueue";

const LOW_MAX = 1000;
const MID_MIN = 1001;
const MID_MAX = 2000;
const HIGH_MIN = 2001;


/* ============================================================
   HTTP
============================================================ */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {

  try {

    const params = e.parameter || {};
    const action = params.action;

    if (!action) {
      return jsonResponse({
        success: false,
        error: "No action specified"
      });
    }

    if (action === "member") {
      return getMember(params.citizenship_id);
    }

    if (action === "events_list"){
      return getEvents()
    }

    if (action === "report"){
      return reportMember(params.person, params.event)
    }

    if (action === "report_data") {
      return getReportData();
    }

    if (action === "people_list"){
      return getPeopleList()
    }

    if (action === "admin_login") {
      return adminLogin(params.password);
    }

    if (action === "admin_data") {
      return getAdminData(params.password);
    }

    if (action === "start_adjustment") {
      return startAdjustment(params);
    }

    if (action === "adjustment_status") {
      return getAdjustmentStatus(params);
    }

    if (action === "stop_adjustment") {
      return stopAdjustment(params);
    }

    if (action === "add_event") {
      return addEvent(params);
    }

    return jsonResponse({
      success: false,
      error: "Unknown action"
    });

  } catch (error) {

    console.error(error);

    return jsonResponse({
      success: false,
      error: error.toString()
    });
  }
}


function jsonResponse(data) {

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ============================================================
   SHEET HELPERS
============================================================ */


function getSheet(name) {

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(name);

  if (!sheet) {
    throw new Error("Sheet not found: " + name);
  }

  return sheet;
}


function getConfigValue(setting) {

  const sheet = getSheet(CONFIG_SHEET);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {

    if (String(values[i][0]) === setting) {
      return String(values[i][1]);
    }
  }

  return null;
}


function adminPasswordCorrect(password) {

  const correctPassword =
    getConfigValue("admin_password");

  return (
    password &&
    password === correctPassword
  );
}


/* ============================================================
   MEMBER MODE
============================================================ */

function getPeopleList() {
  try {
    const peopleSheet = getSheet(PEOPLE_SHEET);
    const peoples = peopleSheet
      .getDataRange()
      .getValues();

    const peopleList = [];
    for (let i = 1; i < peoples.length; i++){
      const peopleName = String(peoples[i][1]).trim();
      const citizenship_id = String(peoples[i][0]).trim();
      if (peopleName) {
        peopleList.push({citizenship_id, peopleName});
      }
    }

    return jsonResponse({
      success: true,
      peoples: peopleList
    });

  }

  catch (error) {
    return jsonResponse({
      success: false,
      error: error.toString()
    });
  }
}

function getReportData() {
  try{
    const peopleSheet = getSheet(PEOPLE_SHEET);
    const peopleValues = peopleSheet
    .getDataRange()
    .getValues();

    const people = [];

    for (let i = 1; i < peopleValues.length; i++) {
      const name = String(peopleValues[i][1]).trim();
      const citizenship_id = String(peopleValues[i][0]).trim();

      if (name) {
        people.push({
          citizenship_id:     citizenship_id,
          peopleName: name
      });
    }
  }

  const reasonsSheet = getSheet(REASONS_SHEET);
  const reasonValues = reasonsSheet
  .getDataRange()
  .getValues();

  const events = [];

  for (let i = 1; i < reasonValues.length; i++) {
    const reason = String(reasonValues[i][0]).trim();

    if (reason) {
      events.push(reason);
    }
  }

  return jsonResponse({
    success: true,
    people: people, 
    events: events,
    people_version: Number(
      getConfigValue("people_version")
    ),
    resons_version: Number(
      getConfigValue("reasons_version")
    )
  });
} catch (error) {
  return jsonResponse({
    success: false,
    error: error.toString()
  });
}
}
function getEvents() {
  try {
    const reasonsSheet = getSheet(REASONS_SHEET);
    const reasons = reasonsSheet
      .getDataRange()
      .getValues();

    const reasonsList = [];
    for (let i = 1; i < reasons.length; i++){
      const reasonsName = String(reasons[i][0]).trim();
      if (reasonsName) {
        reasonsList.push(reasonsName);
      }
    }

    return jsonResponse({
      success: true,
      events: reasonsList
    });

  }

  catch (error) {
    return jsonResponse({
      success: false,
      error: error.toString()
    });
  }
}

function getMember(citizenshipId) {

  if (!citizenshipId) {

    return jsonResponse({
      success: false,
      error: "Missing citizenship ID"
    });
  }

  const peopleSheet =
    getSheet(PEOPLE_SHEET);

  const people =
    peopleSheet
      .getDataRange()
      .getValues();

  let person = null;

  for (let i = 1; i < people.length; i++) {

    if (
      String(people[i][0]) ===
      String(citizenshipId)
    ) {

      person = {
        citizenship_id:
          String(people[i][0]),

        name:
          String(people[i][1]),

        score:
          Number(people[i][2])
      };

      break;
    }
  }

  if (!person) {

    return jsonResponse({
      success: false,
      error: "Citizenship ID not found"
    });
  }


  const eventsSheet =
    getSheet(EVENTS_SHEET);

  const events =
    eventsSheet
      .getDataRange()
      .getValues();

  const memberEvents = [];

  for (let i = 1; i < events.length; i++) {

    if (
      String(events[i][1]) ===
      String(citizenshipId)
    ) {

      /*
       IMPORTANT:
       reported_by is deliberately NOT returned.
      */

      memberEvents.push({

        event_id:
          String(events[i][0]),

        reason:
          String(events[i][2]),

        points:
          Number(events[i][3]),

        timestamp:
          String(events[i][5]),

        event_type:
          String(events[i][6])
      });
    }
  }


  return jsonResponse({

    success: true,

    person: person,

    events: memberEvents
  });
}


function reportMember(person, event) {

  const peopleSheet = getSheet(PEOPLE_SHEET);
  const people = peopleSheet.getDataRange().getValues();


  let row = -1;
  let oldScore = 0;

  let personsCitizenshipId = "";

  for (
    let i = 1;
    i < people.length;
    i++
  ) {
    if (String(people[i][0]) === String(person) || String(people[i][1]) === String(person)){
      
      row = i + 1;
      oldScore = Number(people[i][2]);
      personsCitizenshipId = String(people[i][0])

      break;
    }
  }

  if (row === -1) {
    return jsonResponse({
      success: false,
      error: "Person not found"
    });
  }

  const reasonsSheet = getSheet(REASONS_SHEET);
  const reasons = reasonsSheet.getDataRange().getValues();

  let points = null;

  for (let i = 1; i < reasons.length; i++) {
    if (String(reasons[i][0]).trim() === String(event).trim()) {
      points = Number(reasons[i][1]);

      break;
    }
  }

  if (points === null || isNaN(points)) {
    return jsonResponse({
      success: false,
      error: "Event not found ):"
    }
    );
  }

  const newScore = oldScore + points;

  peopleSheet
    .getRange(row, 3)
    .setValue(newScore);

  const eventsSheet = getSheet(EVENTS_SHEET);

  const eventId = 
    new Date().getTime().toString();
  
  eventsSheet.appendRow([
    eventId,
    personsCitizenshipId,
    event,
    points,
    "MEMBER",
    new Date(),
    "REPORT"
  ]);

  return jsonResponse({
    success: true,
    citizenship_id: personsCitizenshipId,
    reason: event, 
    old_score: oldScore, 
    points: points,
    new_score: newScore
  });
}




/* ============================================================
   ADMIN LOGIN
============================================================ */

function adminLogin(password) {

  if (adminPasswordCorrect(password)) {

    return jsonResponse({
      success: true
    });
  }

  return jsonResponse({

    success: false,
    error: "Incorrect password"
  });
}


/* ============================================================
   ADMIN DATA
============================================================ */

function getAdminData(password) {

  if (!adminPasswordCorrect(password)) {

    return jsonResponse({

      success: false,
      error: "Unauthorized"
    });
  }

  const peopleSheet =
    getSheet(PEOPLE_SHEET);

  const values =
    peopleSheet
      .getDataRange()
      .getValues();

  const people = [];

  for (let i = 1; i < values.length; i++) {

    people.push({

      citizenship_id:
        String(values[i][0]),

      name:
        String(values[i][1]),

      score:
        Number(values[i][2])
    });
  }


  const reasonsSheet =
    getSheet(REASONS_SHEET);

  const reasonValues =
    reasonsSheet
      .getDataRange()
      .getValues();

  const reasons = [];

  for (let i = 1; i < reasonValues.length; i++) {

    reasons.push({

      reason:
        String(reasonValues[i][0]),

      default_points:
        Number(reasonValues[i][1])
    });
  }


  const active =
    getActiveAdjustment();


  return jsonResponse({

    success: true,

    people: people,

    reasons: reasons,

    adjustment: active
  });
}


/* ============================================================
   NORMAL EVENT
============================================================ */

function addEvent(params) {

  const reporter =
    params.reported_by;

  const target =
    params.citizenship_id;

  const reason =
    params.reason;

  const points =
    Number(params.points);

  if (
    !target ||
    !reason ||
    isNaN(points)
  ) {

    return jsonResponse({

      success: false,
      error: "Missing event information"
    });
  }


  const peopleSheet =
    getSheet(PEOPLE_SHEET);

  const people =
    peopleSheet
      .getDataRange()
      .getValues();

  let row = -1;
  let oldScore = 0;

  for (let i = 1; i < people.length; i++) {

    if (
      String(people[i][0]) ===
      String(target)
    ) {

      row = i + 1;
      oldScore = Number(people[i][2]);

      break;
    }
  }


  if (row === -1) {

    return jsonResponse({

      success: false,
      error: "Person not found"
    });
  }


  const newScore =
    oldScore + points;


  peopleSheet
    .getRange(row, 3)
    .setValue(newScore);


  const eventsSheet =
    getSheet(EVENTS_SHEET);


  const eventId =
    new Date().getTime().toString();


  eventsSheet.appendRow([

    eventId,
    target,
    reason,
    points,
    reporter || "UNKNOWN",
    new Date(),
    "REPORT"

  ]);


  return jsonResponse({

    success: true,

    new_score:
      newScore
  });
}


function onEdit(e) {

  const sheet =
    e.range.getSheet();

  const sheetName =
    sheet.getName();


  if (
    sheetName !== PEOPLE_SHEET &&
    sheetName !== REASONS_SHEET
  ) {
    return;
  }


  const configSheet =
    getSheet(CONFIG_SHEET);

  const values =
    configSheet
      .getDataRange()
      .getValues();


  const setting =
    sheetName === PEOPLE_SHEET
      ? "people_version"
      : "reasons_version";


  for (let i = 1; i < values.length; i++) {

    if (
      String(values[i][0]).trim() ===
      setting
    ) {

      const current =
        Number(values[i][1]) || 0;

      configSheet
        .getRange(i + 1, 2)
        .setValue(current + 1);

      break;
    }
  }
}


/* ============================================================
   INTERVALS
============================================================ */

function getInterval(score) {

  score = Number(score);

  if (score <= LOW_MAX) {
    return "low";
  }

  if (
    score >= MID_MIN &&
    score <= MID_MAX
  ) {
    return "mid";
  }

  return "high";
}


function getDistribution(people) {

  const distribution = {

    low: 0,
    mid: 0,
    high: 0
  };

  people.forEach(person => {

    distribution[
      getInterval(person.score)
    ]++;
  });

  return distribution;
}


/* ============================================================
   REASONS
============================================================ */

function getReasons() {

  const sheet =
    getSheet(REASONS_SHEET);

  const values =
    sheet
      .getDataRange()
      .getValues();

  const reasons = [];

  for (let i = 1; i < values.length; i++) {

    const reason =
      String(values[i][0]);

    const points =
      Number(values[i][1]);

    if (
      reason &&
      !isNaN(points) &&
      points !== 0
    ) {

      reasons.push({

        reason: reason,

        points: points
      });
    }
  }

  return reasons;
}


/* ============================================================
   RANDOM USEFUL REASON
============================================================ */

function shuffle(array) {

  const copy =
    array.slice();

  for (
    let i = copy.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    const temp =
      copy[i];

    copy[i] =
      copy[j];

    copy[j] =
      temp;
  }

  return copy;
}


/*
Returns reasons that move the person closer
to the desired interval.
*/

function usefulReasons(
  score,
  target
) {

  const reasons =
    getReasons();

  const useful = [];

  for (const reason of reasons) {

    const newScore =
      score + reason.points;


    /*
       Person needs to go DOWN.
    */

    if (
      target === "low" &&
      score > LOW_MAX &&
      reason.points < 0
    ) {

      if (
        Math.abs(
          LOW_MAX - newScore
        ) <
        Math.abs(
          LOW_MAX - score
        )
      ) {

        useful.push(reason);
      }
    }


    /*
       Person needs to go UP
       into high.
    */

    else if (
      target === "high" &&
      score < HIGH_MIN &&
      reason.points > 0
    ) {

      if (
        Math.abs(
          HIGH_MIN - newScore
        ) <
        Math.abs(
          HIGH_MIN - score
        )
      ) {

        useful.push(reason);
      }
    }


    /*
       Person needs to go into mid.
    */

    else if (
      target === "mid"
    ) {

      if (
        score < MID_MIN &&
        reason.points > 0
      ) {

        if (
          Math.abs(
            MID_MIN - newScore
          ) <
          Math.abs(
            MID_MIN - score
          )
        ) {

          useful.push(reason);
        }
      }


      else if (
        score > MID_MAX &&
        reason.points < 0
      ) {

        if (
          Math.abs(
            MID_MAX - newScore
          ) <
          Math.abs(
            MID_MAX - score
          )
        ) {

          useful.push(reason);
        }
      }
    }
  }

  return shuffle(useful);
}


/* ============================================================
   TARGET ASSIGNMENT
============================================================ */

function assignTargets(
  people,
  targetCounts
) {

  const shuffled =
    shuffle(people);

  const assignments = [];

  let index = 0;


  for (
    let i = 0;
    i < targetCounts.low;
    i++
  ) {

    assignments.push({

      person: shuffled[index++],

      target: "low"
    });
  }


  for (
    let i = 0;
    i < targetCounts.mid;
    i++
  ) {

    assignments.push({

      person: shuffled[index++],

      target: "mid"
    });
  }


  for (
    let i = 0;
    i < targetCounts.high;
    i++
  ) {

    assignments.push({

      person: shuffled[index++],

      target: "high"
    });
  }


  return assignments;
}


/* ============================================================
   BUILD ADJUSTMENT PLAN
============================================================ */

function buildPlan(
  people,
  targetCounts
) {

  const totalPeople =
    people.length;

  const totalTargets =
    targetCounts.low +
    targetCounts.mid +
    targetCounts.high;


  if (
    totalTargets !==
    totalPeople
  ) {

    return {

      success: false,

      error:
        "Target distribution must contain exactly " +
        totalPeople +
        " people."
    };
  }


  /*
     Try multiple random assignments.
     We want to find one where every person
     can reach their assigned interval.
  */

  for (
    let attempt = 0;
    attempt < 200;
    attempt++
  ) {

    const assignments =
      assignTargets(
        people,
        targetCounts
      );

    const simulated =
      people.map(person => ({

        citizenship_id:
          person.citizenship_id,

        name:
          person.name,

        score:
          person.score,

        target:
          null
      }));


    const byId = {};

    simulated.forEach(person => {

      byId[
        person.citizenship_id
      ] = person;
    });


    assignments.forEach(a => {

      byId[
        a.person.citizenship_id
      ].target =
        a.target;
    });


    const plan = [];

    let failed = false;


    /*
       Work through every person.

       Maximum of 1000 events per person
       prevents an accidental infinite loop.
    */

    for (
      const person of simulated
    ) {

      if (
        getInterval(person.score) ===
        person.target
      ) {

        continue;
      }


      let safety = 0;


      while (
        getInterval(person.score) !==
        person.target
      ) {

        safety++;


        if (safety > 1000) {

          failed = true;
          break;
        }


        const possible =
          usefulReasons(
            person.score,
            person.target
          );


        if (
          possible.length === 0
        ) {

          failed = true;
          break;
        }


        /*
           Random useful reason.

           We bias slightly toward reasons
           that make the person cross the
           boundary rather than stopping
           just short of it.
        */

        const crossing =
          possible.filter(reason => {

            const newScore =
              person.score +
              reason.points;

            return (
              getInterval(newScore) ===
              person.target
            );
          });


        let selected;


        if (
          crossing.length > 0
        ) {

          selected =
            crossing[
              Math.floor(
                Math.random() *
                crossing.length
              )
            ];

        } else {

          selected =
            possible[
              Math.floor(
                Math.random() *
                possible.length
              )
            ];
        }


        const oldScore =
          person.score;


        person.score +=
          selected.points;


        plan.push({

          citizenship_id:
            person.citizenship_id,

          reason:
            selected.reason,

          points:
            selected.points,

          old_score:
            oldScore,

          new_score:
            person.score
        });
      }


      if (failed) {
        break;
      }
    }


    if (!failed) {

      /*
         Verify final distribution.
      */

      const finalDistribution = {

        low: 0,
        mid: 0,
        high: 0
      };


      simulated.forEach(person => {

        finalDistribution[
          getInterval(person.score)
        ]++;
      });


      if (
        finalDistribution.low ===
          targetCounts.low &&

        finalDistribution.mid ===
          targetCounts.mid &&

        finalDistribution.high ===
          targetCounts.high
      ) {

        return {

          success: true,

          plan: plan
        };
      }
    }
  }


  return {

    success: false,

    error:
      "Could not find a valid score adjustment using the available reasons. " +
      "Try a different target distribution."
  };
}


/* ============================================================
   START ADJUSTMENT
============================================================ */

function startAdjustment(params) {

  const password =
    params.password;


  if (
    !adminPasswordCorrect(password)
  ) {

    return jsonResponse({

      success: false,
      error: "Unauthorized"
    });
  }


  /*
     Prevent two simultaneous adjustments.
  */

  const existing =
    getActiveAdjustment();


  if (existing) {

    return jsonResponse({

      success: false,

      error:
        "An adjustment is already running."
    });
  }


  const low =
    Number(params.low);

  const mid =
    Number(params.mid);

  const high =
    Number(params.high);

  const duration =
    Number(params.duration);


  if (
    !Number.isInteger(low) ||
    !Number.isInteger(mid) ||
    !Number.isInteger(high)
  ) {

    return jsonResponse({

      success: false,

      error:
        "Invalid target distribution."
    });
  }


  if (
    !Number.isFinite(duration) ||
    duration < 1
  ) {

    return jsonResponse({

      success: false,

      error:
        "Duration must be at least 1 minute."
    });
  }


  const peopleSheet =
    getSheet(PEOPLE_SHEET);

  const values =
    peopleSheet
      .getDataRange()
      .getValues();

  const people = [];


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    people.push({

      citizenship_id:
        String(values[i][0]),

      name:
        String(values[i][1]),

      score:
        Number(values[i][2])
    });
  }


  const targetCounts = {

    low: low,

    mid: mid,

    high: high
  };


  /*
     Build the actual event plan
     BEFORE changing anyone's score.
  */

  const result =
    buildPlan(
      people,
      targetCounts
    );


  if (!result.success) {

    return jsonResponse(result);
  }


  const plan =
    result.plan;


  /*
     Create adjustment ID.
  */

  const adjustmentId =
    "ADJ-" +
    new Date().getTime();


  const now =
    new Date();


  const adjustmentSheet =
    getSheet(ADJUSTMENTS_SHEET);


  adjustmentSheet.appendRow([

    adjustmentId,

    now,

    duration,

    low,

    mid,

    high,

    "RUNNING",

    plan.length,

    0,

    "ADMIN"

  ]);


  /*
     Create queue.

     Events are spread evenly over the duration.
  */

  const queueSheet =
    getSheet(QUEUE_SHEET);


  const intervalMilliseconds =
    plan.length > 1
      ? (
          duration *
          60 *
          1000
        ) /
        plan.length
      : 0;


  const rows = [];


  for (
    let i = 0;
    i < plan.length;
    i++
  ) {

    const item =
      plan[i];


    const scheduled =
      new Date(
        now.getTime() +
        intervalMilliseconds *
        (i + 1)
      );


    rows.push([

      adjustmentId,

      i + 1,

      scheduled,

      item.citizenship_id,

      item.reason,

      item.points,

      "PENDING",

      "",

      item.old_score,

      item.new_score

    ]);
  }


  if (rows.length > 0) {

    queueSheet
      .getRange(
        queueSheet.getLastRow() + 1,
        1,
        rows.length,
        rows[0].length
      )
      .setValues(rows);
  }


  /*
     Make sure the worker trigger exists.
  */

  ensureAdjustmentTrigger();


  return jsonResponse({

    success: true,

    adjustment_id:
      adjustmentId,

    total_changes:
      plan.length,

    duration:
      duration
  });
}


/* ============================================================
   ADJUSTMENT WORKER
============================================================ */

function processAdjustmentQueue() {

  const lock =
    LockService.getScriptLock();

  if (
    !lock.tryLock(5000)
  ) {

    return;
  }


  try {

    const adjustment =
      getActiveAdjustment();


    if (!adjustment) {

      removeAdjustmentTrigger();

      return;
    }


    const queueSheet =
      getSheet(QUEUE_SHEET);

    const values =
      queueSheet
        .getDataRange()
        .getValues();


    const now =
      new Date();


    const peopleSheet =
      getSheet(PEOPLE_SHEET);

    const people =
      peopleSheet
        .getDataRange()
        .getValues();


    let executed =
      adjustment.completed_changes;


    for (
      let i = 1;
      i < values.length;
      i++
    ) {

      const row =
        values[i];


      if (
        String(row[0]) !==
        adjustment.adjustment_id
      ) {

        continue;
      }


      const status =
        String(row[6]);


      if (
        status !== "PENDING"
      ) {

        continue;
      }


      const scheduled =
        new Date(row[2]);


      if (
        scheduled.getTime() >
        now.getTime()
      ) {

        continue;
      }


      const citizenshipId =
        String(row[3]);


      const reason =
        String(row[4]);


      const points =
        Number(row[5]);


      /*
         Find person.
      */

      let personRow =
        -1;

      let oldScore =
        0;


      for (
        let p = 1;
        p < people.length;
        p++
      ) {

        if (
          String(people[p][0]) ===
          citizenshipId
        ) {

          personRow =
            p + 1;

          oldScore =
            Number(people[p][2]);

          break;
        }
      }


      if (
        personRow === -1
      ) {

        queueSheet
          .getRange(i + 1, 7)
          .setValue("ERROR");

        continue;
      }


      const newScore =
        oldScore + points;


      /*
         Actually change score.
      */

      peopleSheet
        .getRange(
          personRow,
          3
        )
        .setValue(newScore);


      /*
         Record event.
      */

      const eventsSheet =
        getSheet(EVENTS_SHEET);


      const eventId =
        new Date()
          .getTime()
          .toString() +
        "-" +
        (i + 1);


      eventsSheet.appendRow([

        eventId,

        citizenshipId,

        reason,

        points,

        "SYSTEM",

        new Date(),

        "SYSTEM_ADJUSTMENT"

      ]);


      /*
         Mark queue item executed.
      */

      queueSheet
        .getRange(i + 1, 7, 1, 4)
        .setValues([[
          "EXECUTED",
          new Date(),
          oldScore,
          newScore
        ]]);


      executed++;
    }


    /*
       Update adjustment.
    */

    const adjustmentSheet =
      getSheet(ADJUSTMENTS_SHEET);

    const adjustmentRow =
      findAdjustmentRow(
        adjustment.adjustment_id
      );


    if (
      adjustmentRow === -1
    ) {

      return;
    }


    if (
      executed >=
      adjustment.total_changes
    ) {

      adjustmentSheet
        .getRange(
          adjustmentRow,
          7,
          1,
          2
        )
        .setValues([[
          "COMPLETED",
          adjustment.total_changes
        ]]);


      removeAdjustmentTrigger();

    } else {

      adjustmentSheet
        .getRange(
          adjustmentRow,
          9
        )
        .setValue(executed);
    }


  } finally {

    lock.releaseLock();
  }
}


/* ============================================================
   ADJUSTMENT STATUS
============================================================ */

function getActiveAdjustment() {

  const sheet =
    getSheet(ADJUSTMENTS_SHEET);

  const values =
    sheet
      .getDataRange()
      .getValues();


  for (
    let i = values.length - 1;
    i >= 1;
    i--
  ) {

    const status =
      String(values[i][6]);


    if (
      status === "RUNNING"
    ) {

      return {

        adjustment_id:
          String(values[i][0]),

        started_at:
          String(values[i][1]),

        duration_minutes:
          Number(values[i][2]),

        target_low:
          Number(values[i][3]),

        target_mid:
          Number(values[i][4]),

        target_high:
          Number(values[i][5]),

        status:
          status,

        total_changes:
          Number(values[i][7]),

        completed_changes:
          Number(values[i][8])
      };
    }
  }


  return null;
}


function findAdjustmentRow(
  adjustmentId
) {

  const sheet =
    getSheet(ADJUSTMENTS_SHEET);

  const values =
    sheet
      .getDataRange()
      .getValues();


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    if (
      String(values[i][0]) ===
      String(adjustmentId)
    ) {

      return i + 1;
    }
  }


  return -1;
}


function getAdjustmentStatus(params) {

  if (
    !adminPasswordCorrect(
      params.password
    )
  ) {

    return jsonResponse({

      success: false,
      error: "Unauthorized"
    });
  }


  const adjustment =
    getActiveAdjustment();


  if (!adjustment) {

    return jsonResponse({

      success: true,

      adjustment: null
    });
  }


  return jsonResponse({

    success: true,

    adjustment: adjustment
  });
}


/* ============================================================
   STOP ADJUSTMENT
============================================================ */

function stopAdjustment(params) {

  if (
    !adminPasswordCorrect(
      params.password
    )
  ) {

    return jsonResponse({

      success: false,
      error: "Unauthorized"
    });
  }


  const adjustment =
    getActiveAdjustment();


  if (!adjustment) {

    return jsonResponse({

      success: false,

      error:
        "No adjustment is running."
    });
  }


  const row =
    findAdjustmentRow(
      adjustment.adjustment_id
    );


  if (row !== -1) {

    getSheet(ADJUSTMENTS_SHEET)
      .getRange(row, 7)
      .setValue("STOPPED");
  }


  removeAdjustmentTrigger();


  return jsonResponse({

    success: true
  });
}


/* ============================================================
   TRIGGER MANAGEMENT
============================================================ */

function ensureAdjustmentTrigger() {

  const triggers =
    ScriptApp.getProjectTriggers();


  for (
    const trigger of triggers
  ) {

    if (
      trigger
        .getHandlerFunction() ===
      "processAdjustmentQueue"
    ) {

      return;
    }
  }


  ScriptApp.newTrigger(
    "processAdjustmentQueue"
  )
    .timeBased()
    .everyMinutes(1)
    .create();
}


function removeAdjustmentTrigger() {

  const triggers =
    ScriptApp.getProjectTriggers();


  for (
    const trigger of triggers
  ) {

    if (
      trigger
        .getHandlerFunction() ===
      "processAdjustmentQueue"
    ) {

      ScriptApp.deleteTrigger(
        trigger
      );
    }
  }
}


// renderMember() - Takes member data and creates the HTML to display it
// Parameter: data - Object containing person info and their events (score changes)
function renderMember(data) {

    // Get the person's information from the data
    const person =
        data.person;  // Name, citizenship_id, score

    // Get the list of events (score adjustments) and reverse them
    // [...data.events] copies the array, .reverse() puts the newest events first
    const events =
        [...(data.events || [])].reverse();


    // This will hold the HTML for displaying all events
    let eventsHTML = "";


    // Check if there are any events to display
    if (events.length === 0) {

        // No events yet, show a message
        eventsHTML =
            `<p class="small">
                No reports yet.
            </p>`;

    } else {

        // Create HTML for each event
        // .map() goes through each event and transforms it into HTML
        eventsHTML =
            events.map(event => {

                // Check if the points are positive (good) or negative (bad)
                const positive =
                    event.points >= 0;  // >= means "greater than or equal to"

                // Add a "+" for positive points, nothing for negative
                const sign =
                    positive ? "+" : "";  // Ternary operator: if positive, "+", else empty


                // Return the HTML for this one event
                return `

                    <div class="event">

                        <!-- The reason for this score change -->
                        <strong>
                            ${escapeHTML(
                                event.reason  // What caused the score change
                            )}
                        </strong>

                        <!-- Show the points with appropriate color (green/red) -->
                        <span class="${
                            positive
                                ? "positive"   // Green color for good points 
                                : "negative"   // Red color for bad points 
                        }">

                            ${sign}${event.points}  <!-- Show "+" or nothing, then the number -->

                        </span>

                        <!-- When this happened -->
                        <div class="small">
                            ${escapeHTML(
                                event.timestamp  // Date and time
                            )}
                        </div>

                    </div>
                `;

            }).join("");  // .join("") combines all event HTML into one string
    }


    // Create and display the complete member profile HTML
    setContent(`

        <!-- Card 1: Welcome and Score -->
        <div class="card">

            <!-- Welcome message with member's name -->
            <h2>
                Welcome,
                ${escapeHTML(person.name)}  <!-- Display the person's name -->
            </h2>

            <!-- The member's current social credit score (large display) -->

            <div class="score-panel">
                <div class = "score-label">
                    SOCIAL CREDIT SCORE
                </div>

                <div class="score">
                    ${person.score}  
                </div>

                <div class="score-status">
                    ${getScoreStatus(person.score)}
                </div>
            </div>



            <!-- Their citizenship ID -->
            <div class="citizenship">

                Citizenship ID:
                ${escapeHTML(
                    person.citizenship_id  //<!-- The unique ID -->
                )}

            </div>

        </div>

        <!-- Report button: report something -->
        <button id="report-button" class="report-button">
            REPORT DEVIANT BEHAVIOUR
        </button>


        <!-- Card 2: List of events -->
        <div class="card">

            <h2>
                Citizen Activity Log
            </h2>

            <p class="small">
                All recorded behavioural events are PERMANENTLY archived.
            </p>
            
            <div class = "activity-log">
                ${eventsHTML}  
            </div>

        </div>


        <!-- Card 3: Action buttons -->
        <div class="card">

            <!-- Refresh button to get latest data -->
            <button id="refresh-button">
                REFRESH
            </button>

            <!-- Logout button: Change to a different citizenship ID -->
            <button id="change-id-button">
                CHANGE CITIZENSHIP ID
            </button>

        </div>
    `);

    // Click handlers
    document
    .getElementById("report-button") 
    .onclick = () => {  
        reportScreen() 
    }


    // Refresh button: reload the member data from the server
    document
        .getElementById(
            "refresh-button"
        )
        .onclick = () =>
            refreshMember(
                person.citizenship_id  // Reload this person's profile
            );


    // Change ID button: logout the user and show login screen
    document
        .getElementById(
            "change-id-button"
        )
        .onclick = () => {

            // Remove the saved ID from computer
            clearID();

            // Show the login screen
            showLogin();
        };
}

function getScoreStatus(score) {
    if (score <= 1000) {
        return "⚠ LOW COMPLIANCE";
    }

    if (score <= 2000) {
        return "● ACCEPTABLE CITIZEN";
    }

    return "★ EXEMPLARY CITIZEN";
}


// reportScreen() - Shows the screen to report another member's behavior
async function reportScreen(){
    setContent(`
        <div class="card">
            <h2>REPORTING SYSTEM</h2>
            <p>Accessing citizen registry...</p>
            <div class="loading-bar"></div>
        </div>
    `);

    try {
        let reportData = getCachedReportData();

        if (reportData) {
            renderReportScreen(
                reportData.people,
                reportData.events
            );
            return
        }

        // Fetch list of events that can be reported
        const result = await api(
            "report_data",
            {}
        );

        if (!result.success) {
            throw new Error(
                result.error || "Failed to load report data"
            );
        }

        reportData = {
            people: result.people || [],
            events: result.events || []
        };

        saveCachedReportData(
            reportData
        );

        renderReportScreen(
            reportData.people,
            reportData.events
        );
    }catch (error) {
        setContent(`
            <div class="card error">
                Error loading report screen:
                ${escapeHTML(error.message)}
            </div>
        `);
    }
    }

function renderReportScreen(people_list, events_list) {
    const eventsHTML = events_list.map(event => {
        return `
            <a href="#" data-event="${event}">
                ${event}
            </a>
        `;
    }).join("");

    const peopleHTML = people_list.map(person => {
        return `
            <a href="#" data-person="${person.citizenship_id}">
                ${person.peopleName} (${person.citizenship_id})
            </a>
        `;
    }).join("");

    // Create and display the reporting form
    setContent(`

            <!-- Reporting Card -->
            <div class="card">

                <h2>SUBMIT BEHAVIOURAL REPORT</h2>

                <label>
                    SUBJECT CITIZEN.
                </label>

                <!-- Dropdown to select the reason/event -->
                <div class="dropdown" style="margin-top: 20px;">
                    <button id="dropdown-people-button" class="dropbtn">
                        SELECT CITIZEN.
                    </button>
                    <div id="myDropdown_people" class="dropdown-content">
                        <input 
                            type="text" 
                            placeholder="Search.." 
                            id="myInput_people"
                        >
                        ${peopleHTML}
                    </div>
                </div>

                <label>
                    VIOLATION/BEHAVIOURAL EVENT.
                </label>

                <!-- Dropdown to select the reason/event -->
                <div class="dropdown" style="margin-top: 20px;">
                    <button id="dropdown-button" class="dropbtn">
                        SELECT CLASSIFICATION.
                    </button>
                    <div id="myDropdown" class="dropdown-content">
                        <input 
                            type="text" 
                            placeholder="Search.." 
                            id="myInput"
                        >
                        ${eventsHTML}
                    </div>
                </div>

                <!-- Error/status message -->
                <p id="report-error" class="error" style="margin-top: 20px;"></p>

                <!-- Submit button -->
                <button id="login-report-button" style="margin-top: 20px;">
                    SUBMIT REPORT
                </button>

                <!-- Back button -->
                <button id="report-back-button" style="margin-top: 10px;">
                    BACK
                </button>

            </div>
        `);

        // Add CSS for dropdown styling
        const style = document.createElement('style');
        style.textContent = `
            .dropbtn {
                background-color: #951111;
                color: white;
                padding: 12px 16px;
                font-size: 16px;
                border: none;
                cursor: pointer;
                width: 100%;
            }
            .dropbtn:hover, .dropbtn:focus {
                background-color: rgb(54, 6, 6);
            }
            #myInput,
            #myInput_people,
            #personInput {
                box-sizing: border-box;
                font-size: 16px;
                padding: 12px 16px;
                border: none;
                border-bottom: 1px solid #ddd;
                width: 100%;
            }
            #myInput:focus,
            #myInput_people:focus,
            #personInput:focus {
                outline: 3px solid #04AA6D;
            }
            .dropdown {
                position: relative;
                display: block;
                width: 100%;
            }
            .dropdown-content {
                display: none;
                position: absolute;
                background-color: #f6f6f6;
                width: 100%;
                overflow: auto;
                border: 1px solid #ddd;
                z-index: 1;
                max-height: 200px;
                overflow-y: auto;
            }
            .dropdown-content a {
                color: black;
                padding: 12px 16px;
                text-decoration: none;
                display: block;
            }
            .dropdown-content a:hover {background-color: #ddd;}
            .show {display: block;}
        `;
        document.head.appendChild(style);

        // Variables to store selected values
        let selectedPerson = null;
        let selectedEvent = null;

        function setupDropdown(buttonId, contentId, inputId, onSelect) {
            const dropdownBtn = document.getElementById(buttonId);
            const dropdownContent = document.getElementById(contentId);
            const searchInput = document.getElementById(inputId);
            const links = dropdownContent.querySelectorAll("a");

            dropdownBtn.onclick = function(e) {
                e.preventDefault();
                dropdownContent.classList.toggle("show");
                searchInput.focus();
            };

            searchInput.onkeyup = function() {
                dropdownContent.classList.add("show");
                const filter = this.value.toUpperCase();

                links.forEach(link => {
                    const text = (link.textContent || link.innerText || "").toUpperCase();
                    link.style.display = text.includes(filter) ? "" : "none";
                });
            };

            searchInput.onclick = function(e) {
                e.stopPropagation();
                dropdownContent.classList.add("show");
            };

            links.forEach(link => {
                link.onclick = function(e) {
                    e.preventDefault();
                    onSelect(link);
                    dropdownContent.classList.remove("show");
                };
            });
        }

        setupDropdown("dropdown-people-button", "myDropdown_people", "myInput_people", function(link) {
            selectedPerson = link.dataset.person;
            document.getElementById("dropdown-people-button").innerText = link.textContent;
        });

        setupDropdown("dropdown-button", "myDropdown", "myInput", function(link) {
            selectedEvent = link.dataset.event;
            document.getElementById("dropdown-button").innerText = selectedEvent;
        });

        // ============ SUBMIT BUTTON ============

        // Handle submit button
        document.getElementById("login-report-button").onclick = async function() {
            const errorEl = document.getElementById("report-error");
            const currentUserID = getSavedID();

            // Validate inputs
            if (!selectedPerson) {
                errorEl.innerText = "Please select a person to report.";
                return;
            }
            if (!selectedEvent) {
                errorEl.innerText = "Please select a reason for the report.";
                return;
            }

            // Check if trying to report yourself
            if (String(selectedPerson) === String(currentUserID)) {
                errorEl.innerText = "You cannot report yourself.";
                return;
            }

            // Check rate limiting - max one report per minute
            const lastReportTime = parseInt(localStorage.getItem("last_report_time") || "0");
            const currentTime = Date.now();
            const timeSinceLastReport = currentTime - lastReportTime;
            const oneMinuteMs = 60000;

            if (timeSinceLastReport < oneMinuteMs) {
                const secondsToWait = Math.ceil((oneMinuteMs - timeSinceLastReport) / 1000);
                errorEl.innerText = `Please wait ${secondsToWait} seconds before submitting another report.`;
                return;
            }

            // Show loading message
            errorEl.innerText = "Submitting report...";

            // Submit the report
            await report(selectedPerson, selectedEvent);
        };

        // Handle back button
        document.getElementById("report-back-button").onclick = function() {
            const currentUserID = getSavedID();
            showMember(currentUserID );
        };

    }

// report() - Sends a report to the server
// Parameters:
//   - person: Citizenship ID or name of person being reported
//   - event: The reason/type of report
async function report(person, event) {
    try {
        // Send the report to the server
        const result = await api(
            "report",  // Tell server to process a report
            {
                person: person,  // Who to report
                event: event     // Why they're being reported
            }
        );

        // Check if report was successful
        if (!result.success) {
            // Show error message to user
            document.getElementById("report-error").innerText = result.error;
            return;
        }

        // Success! Store the current time to enforce rate limiting
        localStorage.setItem("last_report_time", Date.now().toString());

        // Show confirmation message as text
        const errorEl = document.getElementById("report-error");
        errorEl.innerText = "Report submitted successfully!";
        errorEl.style.color = "green";  // Change text color to green for success

    } catch (error) {
        // Network or server error
        document.getElementById("report-error").innerText = 
            "Error submitting report: " + error.message;
    }
}
/* ============================================================
   ADMIN LOGIN - Admin authentication screen and password validation
============================================================ */

// showAdminLogin() - Displays the admin login screen with password input
function showAdminLogin() {

    // Create and display the admin login form
    setContent(`

        <div class="card">

            <h2>
                Admin mode  <!-- Title -->
            </h2>

            <!-- Password input field (hides what user types as dots) -->
            <input
                id="admin-password"
                type="password" 
                placeholder="Admin password"
            >

            <!-- Submit button -->
            <button id="admin-login-button">
                LOGIN
            </button>

            <!-- Error message display area -->
            <p
                id="admin-error"
                class="error"
            ></p>

            <!-- Back button to return to member login -->
            <button id="back-button">
                BACK
            </button>

        </div>
    `);


    // Set up button click handlers
    document
        .getElementById(
            "admin-login-button"
        )
        .onclick = adminLogin;  // When LOGIN clicked, run adminLogin()


    document
        .getElementById(
            "back-button"
        )
        .onclick = showLogin;  // When BACK clicked, return to member login
}


// adminLogin() - Called when admin clicks the LOGIN button
// This function validates the admin password
async function adminLogin() {

    // Get the password the admin typed in the password field
    const password =
        document
            .getElementById(
                "admin-password"
            )
            .value;  // Get what was typed
    
    const loginButton =
        document.getElementById("admin-login-button");
    const errorElement =
        document.getElementById("admin-error");
    loginButton.disabled = true;
    loginButton.innerText = "AUTHENTICATING...";
    errorElement.innerText = "";

    try {

        // Send the password to the server for validation
        const result =
            await api(
                "admin_login",  // Tell server: validate an admin
                {
                    password: password  // Send the password
                }
            );


        // Check if the password was correct
        if (!result.success) {

            errorElement.innerText = result.error;

            loginButton.disabled = false;
            loginButton.innerText = "LOGIN";

            return;
        }


        // Password is correct! Save it temporarily in session storage
        // sessionStorage is like localStorage but gets cleared when browser closes
        sessionStorage.setItem(
            "admin_password",  // Save under this name
            password            // The password
        );


        // Show the admin dashboard with all the admin controls
        await showAdmin(password);

    } catch (error) {

        // Network error or server problem
        // Display the error message
        document
            .getElementById(
                "admin-error"
            )
            .innerText =
                error.message;  // Show what went wrong
    }
}


/* ============================================================
   ADMIN DASHBOARD - Show admin control panel
============================================================ */

// showAdmin() - Fetches admin data from server and displays the admin dashboard
// Parameter: password - The admin password for authentication
async function showAdmin(password) {

    try {

        // Ask the server for all admin data
        const result =
            await api(
                "admin_data",  // Get admin information
                {
                    password: password  // Authenticate with password
                }
            );


        // Check if the request was successful
        if (!result.success) {

            // Something went wrong, show login again
            showAdminLogin();

            return;  // Stop here
        }


        // Success! Render the admin dashboard with the data
        renderAdmin(
            result.people,          // List of all people and their scores
            result.adjustment,      // Current adjustment process info (if running)
            password                // Pass password for future API calls
        );

    } catch (error) {

        // Network or server error
        // Show the error message
        setContent(`

            <div class="card error">

                ${escapeHTML(
                    error.message  // Display what went wrong
                )}

            </div>
        `);
    }
}


// getDistribution() - Counts how many people are in each score category
// Parameter: people - Array of all people with their scores
// Returns: Object with counts for low, mid, and high score ranges
function getDistribution(people) {

    // Create an object to hold the counts
    const result = {

        low: 0,   // Count of people with score <= 1000
        mid: 0,   // Count of people with score 1001-2000
        high: 0   // Count of people with score 2001+
    };


    // Go through each person and put them in the right category
    people.forEach(person => {

        // Check score and increment the appropriate counter
        if (person.score <= 1000) {

            result.low++;  // Add 1 to low count

        } else if (
            person.score <= 2000  // Between 1001 and 2000
        ) {

            result.mid++;  // Add 1 to mid count

        } else {

            result.high++;  // Add 1 to high count
        }
    });


    // Return the counts
    return result;
}


/* ============================================================
   ADMIN UI - Render the admin dashboard
============================================================ */

// renderAdmin() - Creates and displays the admin dashboard
// Parameters:
//   - people: Array of all people with their scores
//   - adjustment: Current adjustment process status (or null if not running)
//   - password: Admin password for API calls
function renderAdmin(
    people,
    adjustment,
    password
) {

    // Get the distribution of people across score categories
    const distribution =
        getDistribution(people);  // Returns {low: #, mid: #, high: #}


    // Check if there's an adjustment currently running
    const running =
        adjustment &&  // If adjustment exists...
        adjustment.status === "RUNNING";  // ...and status is RUNNING


    // Create and display the admin dashboard
    setContent(`

        <!-- Card 1: Title and Current Distribution -->
        <div class="card">

            <h2>
                ADMIN MODE  <!-- Admin panel title -->
            </h2>

            <p>
                Current distribution:  <!-- Show current state -->
            </p>

            <!-- Display counts of people in each category -->
            <div class="distribution">

                <!-- LOW score people count -->
                <div>
                    <strong>
                        ${distribution.low}  <!-- Number of low-score people -->
                    </strong>
                    <span>LOW</span>  <!-- Category label -->
                </div>

                <!-- MID score people count -->
                <div>
                    <strong>
                        ${distribution.mid}  <!-- Number of mid-score people -->
                    </strong>
                    <span>MID</span>  <!-- Category label -->
                </div>

                <!-- HIGH score people count -->
                <div>
                    <strong>
                        ${distribution.high}  <!-- Number of high-score people -->
                    </strong>
                    <span>HIGH</span>  <!-- Category label -->
                </div>

            </div>

        </div>


        <!-- Card 2: Either the adjustment form OR the progress display -->
        ${
            running
                ? renderRunningAdjustment(  // If adjustment is running, show progress
                    adjustment,
                    password
                  )
                : renderAdjustmentForm(  // If not running, show form to start one
                    people,
                    password
                  )
        }


        <!-- Card 3: Control buttons -->
        <div class="card">

            <!-- Refresh data button -->
            <button id="admin-refresh">
                REFRESH
            </button>

            <!-- Logout button -->
            <button id="admin-logout">
                LOG OUT
            </button>

        </div>
    `);


    // Refresh button: reload the admin dashboard
    document
        .getElementById(
            "admin-refresh"
        )
        .onclick = () =>
            showAdmin(password);  // Call showAdmin to reload


    // Logout button: clear password and return to login
    document
        .getElementById(
            "admin-logout"
        )
        .onclick = () => {

            // Remove the stored admin password
            sessionStorage.removeItem(
                "admin_password"
            );

            // Return to member login screen
            showLogin();
        };


    // Set up the correct button handler based on adjustment status
    if (!running) {

        // If no adjustment is running, set up the START button
        document
            .getElementById(
                "start-adjustment"  // Find the START button
            )
            .onclick = () =>
                startAdjustment(password);  // When clicked, start adjustment

    } else {

        // If adjustment IS running, set up the STOP button
        document
            .getElementById(
                "stop-adjustment"  // Find the STOP button
            )
            .onclick = () =>
                stopAdjustment(password);  // When clicked, stop adjustment
    }
}


/* ============================================================
   ADJUSTMENT FORM - Form to set target distribution
============================================================ */

// renderAdjustmentForm() - Creates the form to set target score distribution
// Parameters:
//   - people: Array of all people (used to count totals)
//   - password: Admin password for API calls
function renderAdjustmentForm(
    people,
    password
) {

    return `

        <div class="card">

            <h2>
                Target distribution  <!-- Set what we want the distribution to be -->
            </h2>

            <!-- Show how many people total -->
            <p class="small">
                There are
                ${people.length}  <!-- Total number of people -->
                people.
            </p>


            <!-- Input for LOW category target -->
            <label>
                Low  <!-- Category label -->
                <small>
                    -∞ to 1000  <!-- Score range for this category -->
                </small>
            </label>

            <!-- Number input to set target count for LOW -->
            <input
                id="target-low"
                type="number" 
                min="0"  
                value="${getDistribution(
                    people
                ).low}"
            >


            <!-- Input for MID category target -->
            <label>
                Mid 
                <small>
                    1001 to 2000 
                </small>
            </label>

            <!-- Number input to set target count for MID -->
            <input
                id="target-mid"
                type="number"
                min="0"
                value="${getDistribution(
                    people
                ).mid}" 
            >


            <!-- Input for HIGH category target -->
            <label>
                High 
                <small>
                    2001+ 
                </small>
            </label>

            <!-- Number input to set target count for HIGH -->
            <input
                id="target-high"
                type="number"
                min="0"
                value="${getDistribution(
                    people
                ).high}" 
            >


            <!-- Duration setting -->
            <label>
                Adjustment duration 
                <small>
                    minutes
                </small>
            </label>

         
            <input
                id="duration"
                type="number"
                min="1" 
                value="180" 
            >


            <!-- Start button -->
            <button id="start-adjustment">
                START SCORE ADJUSTMENT
            </button>

            <!-- Error message display -->
            <p
                id="adjustment-error"
                class="error"
            ></p>

        </div>
    `;
}


/* ============================================================
   RUNNING ADJUSTMENT - Progress display during adjustment
============================================================ */

// renderRunningAdjustment() - Shows the progress of the current adjustment
// Parameters:
//   - adjustment: Object with adjustment details (progress, targets, etc.)
//   - password: Admin password
function renderRunningAdjustment(
    adjustment,
    password
) {

    // Get the total and completed changes
    const total =
        adjustment.total_changes;  // How many changes need to be made total

    const completed =
        adjustment.completed_changes;  // How many have been done so far


    // Calculate the percentage complete
    const percentage =
        total === 0  // If total is 0, avoid division by zero
            ? 100  // Show 100% complete
            : Math.round(  // Otherwise, round the result
                completed /  // Divide completed
                total *      // By total
                100          // And multiply by 100 to get percentage
              );


    return `

        <div class="card">

            <h2>
                Adjustment in progress  <!-- Title -->
            </h2>

            <!-- Progress bar visualization -->
            <div class="progress">

                <!-- The colored bar that fills up -->
                <div
                    class="progress-bar"
                    style="width:${percentage}%"  <!-- Width shows progress -->
                ></div>

            </div>

            <!-- Completed count -->
            <p>
                ${completed}  <!-- Number completed -->
                /
                ${total}  <!-- Out of total -->
                changes completed  <!-- Label -->
            </p>

            <!-- Percentage complete -->
            <p>
                ${percentage}%  <!-- Show percentage -->
            </p>

            <!-- Show what we're aiming for -->
            <p>
                Target:  <!-- Label -->
            </p>

            <!-- Target distribution display -->
            <div class="distribution">

                <!-- Target LOW count -->
                <div>
                    <strong>
                        ${adjustment.target_low}  <!-- Target number for LOW -->
                    </strong>
                    <span>LOW</span>
                </div>

                <!-- Target MID count -->
                <div>
                    <strong>
                        ${adjustment.target_mid}  <!-- Target number for MID -->
                    </strong>
                    <span>MID</span>
                </div>

                <!-- Target HIGH count -->
                <div>
                    <strong>
                        ${adjustment.target_high}  <!-- Target number for HIGH -->
                    </strong>
                    <span>HIGH</span>
                </div>

            </div>


            <!-- Stop button (colored red for danger action) -->
            <button
                id="stop-adjustment"
                class="danger"  <!-- Red button to stop -->
            >
                STOP ADJUSTMENT
            </button>

        </div>
    `;
}


/* ============================================================
   START ADJUSTMENT - Begin the score adjustment process
============================================================ */

// startAdjustment() - Called when admin clicks START button
// Reads form values and sends adjustment request to server
async function startAdjustment(password) {

    // Get the target LOW value from the input field and convert to number
    const low =
        Number(
            document
                .getElementById(
                    "target-low"  // Find the LOW input
                )
                .value  // Get its value
        );  // Convert text to number


    // Get the target MID value from the input field and convert to number
    const mid =
        Number(
            document
                .getElementById(
                    "target-mid"  // Find the MID input
                )
                .value
        );


    // Get the target HIGH value from the input field and convert to number
    const high =
        Number(
            document
                .getElementById(
                    "target-high"  // Find the HIGH input
                )
                .value
        );


    // Get the duration from the input field and convert to number
    const duration =
        Number(
            document
                .getElementById(
                    "duration"  // Find the duration input
                )
                .value
        );  // In minutes


    // Get the error message element so we can show status updates
    const errorElement =
        document
            .getElementById(
                "adjustment-error"  // Find the error display area
            );


    // Show a message that we're working
    errorElement.innerText =
        "Creating adjustment plan...";


    try {

        // Send the adjustment parameters to the server
        const result =
            await api(
                "start_adjustment",  // Tell server to start adjustment
                {
                    password:  // Authenticate
                        password,

                    low:  // Target low count
                        low,

                    mid:  // Target mid count
                        mid,

                    high:  // Target high count
                        high,

                    duration:  // Duration in minutes
                        duration
                }
            );


        // Check if the server accepted the request
        if (!result.success) {

            // Server rejected it, show error
            errorElement.innerText =
                result.error;  // Display server's error message

            return;  // Stop here
        }


        // Success! Refresh the admin dashboard to show progress
        await showAdmin(password);


    } catch (error) {

        // Network or server error
        // Show the error message
        errorElement.innerText =
            error.message;
    }
}


/* ============================================================
   STOP ADJUSTMENT - Cancel the score adjustment process
============================================================ */

// stopAdjustment() - Called when admin clicks STOP button
// Stops the currently running adjustment
async function stopAdjustment(password) {

    // Ask for confirmation before stopping
    if (
        !confirm(  // Show confirmation dialog
            "Stop the current adjustment?"  // Ask the user
        )
    ) {
        return;  // If they click cancel, stop here
    }


    try {

        // Send stop command to server
        await api(
            "stop_adjustment",  // Tell server to stop the adjustment
            {
                password:  // Authenticate
                    password
            }
        );


        // Refresh the dashboard to show that adjustment stopped
        await showAdmin(password);

    } catch (error) {

        // If something goes wrong, show the error
        alert(error.message);
    }
}


/* ============================================================
   ESCAPE HTML - Security function to prevent attacks
============================================================ */

// escapeHTML() - Converts special HTML characters to safe versions
// This prevents "injection attacks" where bad data could break the page
// Parameter: value - Text that might contain HTML characters
// Returns: Safe version of the text
function escapeHTML(value) {

    // Convert text to string and replace dangerous characters:
    return String(value)
        .replaceAll("&", "&amp;")    // & becomes &amp; (ampersand)
        .replaceAll("<", "&lt;")     // < becomes &lt; (less than)
        .replaceAll(">", "&gt;")     // > becomes &gt; (greater than)
        .replaceAll('"', "&quot;")   // " becomes &quot; (quote)
        .replaceAll("'", "&#039;");  // ' becomes &#039; (apostrophe)
}


/* ============================================================
   AUTO REFRESH WHILE ADJUSTMENT IS RUNNING - Auto-poll for updates
============================================================ */

// This variable stores the ID of the polling interval
// We need this so we can stop polling when the adjustment is done
let adminRefreshTimer = null;


// startAdminPolling() - Automatically refresh admin dashboard every 10 seconds
// This is used while an adjustment is running to show live progress updates
// Parameter: password - Admin password for server authentication
function startAdminPolling(password) {

    // If there's already a polling timer running, stop it first
    if (adminRefreshTimer) {

        clearInterval(  // Stop the old timer
            adminRefreshTimer
        );
    }


    // Create a new timer that runs every 10 seconds (10000 milliseconds)
    // setInterval() runs a function repeatedly at fixed time intervals
    adminRefreshTimer =
        setInterval(
            async () => {  // This arrow function runs every 10 seconds

                try {

                    // Ask server for the latest admin data (progress update)
                    const result =
                        await api(
                            "admin_data",  // Get admin information
                            {
                                password:  // Include password for authentication
                                    password
                            }
                        );


                    // If the request was successful, update the display
                    if (
                        result.success  // Did the server send valid data?
                    ) {

                        // Redraw the admin dashboard with the new data
                        renderAdmin(
                            result.people,      // Updated list of all people
                            result.adjustment,  // Updated adjustment status/progress
                            password
                        );
                    }

                } catch (error) {

                    // If something goes wrong, just log it
                    // The polling will continue trying every 10 seconds
                    console.error(
                        error  // Show the error in browser console
                    );
                }

            },
            10000  // Interval in milliseconds: 10,000 ms = 10 seconds
        );
}


/* ============================================================
   RUN - Application startup
============================================================ */

// This line runs automatically when the page finishes loading
// It calls the start() function, which is the entry point to the whole app
// It checks if the user is logged in and shows the appropriate screen
start();