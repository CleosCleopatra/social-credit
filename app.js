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


    // If there's a saved ID, the user is already logged in
    if (id) {

        // Show their member profile
        await showMember(id);

    } else {

        // No saved ID means they need to log in
        showLogin();
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

        <div class="card">

            <h2>Citizen identification</h2>

            <p>
                Enter your citizenship ID.
            </p>

            <!-- Text input field where user types their ID -->
            <input
                id="citizenship-input"
                placeholder="Citizenship ID"
            >

            <!-- Button to submit the login form -->
            <button id="login-button">
                ENTER
            </button>

            <!-- Paragraph to show error messages -->
            <p
                id="login-error"
                class="error"
            ></p>

        </div>


        <div class="card">

            <!-- Button to enter admin mode -->
            <button id="admin-button">
                ADMIN MODE
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

    // Get the citizenship ID from the input field and remove extra spaces
    const id =
        document
            .getElementById(
                "citizenship-input"
            )
            .value  // Get what the user typed
            .trim();  // Remove spaces from beginning and end


    // Check if the ID field is empty
    if (!id) {

        // Show an error message
        document
            .getElementById(
                "login-error"
            )
            .innerText =
                "Enter your citizenship ID.";

        return; 
    }


    // Show loading message while we wait for the server
    setContent(`
        <div class="card">
            Loading...
        </div>
    `);


    // Try to log in 
    try {

        // Send the citizenship ID to the server
        // The server will check if this ID exists and send back the user's info
        const result =
            await api(
                "member",  // The action we want: get member info
                {
                    citizenship_id: id  // Send the ID
                }
            );


        // Check if the login was successful
        if (!result.success) {

            // Login failed, show the login screen again
            showLogin();

            // Display the error message from the server
            document
                .getElementById(
                    "login-error"
                )
                .innerText =
                    result.error;  // This message comes from the server

            return; 
        }


        // Save the ID so we remember the user next time
        saveID(id);

        // Display the member's profile with their data
        renderMember(result);

    } catch (error) {

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

    // Show loading message while we wait for the server
    setContent(`
        <div class="card">
            Loading...
        </div>
    `);


    try {

        // Ask the server for this member's information
        const result =
            await api(
                "member",  // Get member data
                {
                    citizenship_id: id  // For this specific ID
                }
            );


        // Check if the request was successful
        if (!result.success) {

            // Something went wrong (maybe the ID is no longer valid)
            // Clear the saved ID and show login screen
            clearID();

            showLogin();

            return;  // Stop here
        }


        // Success! Show the member's profile with the data from the server
        renderMember(result);

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


// renderMember() - Takes member data and creates the HTML to display it
// Parameter: data - Object containing person info and their events (score changes)
function renderMember(data) {

    // Get the person's information from the data
    const person =
        data.person;  // Name, citizenship_id, score

    // Get the list of events (score adjustments) and reverse them
    // [...data.events] copies the array, .reverse() puts the newest events first
    const events =
        [...data.events].reverse();


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
            <div class="score">
                ${person.score}  <!-- This is a number like 1500 -->
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
        <button id="report-button">
            REPORT DEVIANT BEHAVIOUR
        </button>


        <!-- Card 2: List of events -->
        <div class="card">

            <h2>
                Your reports  <!-- Title for the events section -->
            </h2>

            ${eventsHTML}  <!-- Display all the events we created above -->

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
            showMember(
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


// reportScreen() - Shows the screen to report another member's behavior
async function reportScreen(){

    try {
        // Fetch list of events that can be reported
        const eventsResult = await api(
            "events_list",  // Get available report types/reasons
            {}
        );

        // Fetch list of people that can be reported
        const peopleResult = await api(
            "people_list",  // Get list of all people
            {}
        );

        // Check if both requests were successful
        if (!eventsResult.success) {
            throw new Error(eventsResult.error || "Failed to load events list");
        }
        if (!peopleResult.success) {
            throw new Error(peopleResult.error || "Failed to load people list");
        }

        // Extract the arrays from responses
        const events_list = eventsResult.events || [];
        const people_list = peopleResult.people || [];

        // Check if both are arrays
        if (!Array.isArray(events_list)) {
            throw new Error("Events list is not an array: " + JSON.stringify(eventsResult));
        }
        if (!Array.isArray(people_list)) {
            throw new Error("People list is not an array: " + JSON.stringify(peopleResult));
        }

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
                    ${person.name} (${person.citizenship_id})
                </a>
            `;
        }).join("");

        // Create and display the reporting form
        setContent(`

            <!-- Reporting Card -->
            <div class="card">

                <h2>Report Member Behavior</h2>

                <p>
                    Select the person you want to report.
                </p>

                <!-- Dropdown to select the reason/event -->
                <div class="dropdown" style="margin-top: 20px;">
                    <button id="dropdown-people-button" class="dropbtn">
                        Select person...
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

                <p>
                    Select the reason for the report.
                </p>

                <!-- Dropdown to select the reason/event -->
                <div class="dropdown" style="margin-top: 20px;">
                    <button id="dropdown-button" class="dropbtn">
                        Select reason...
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
                background-color: #04AA6D;
                color: white;
                padding: 12px 16px;
                font-size: 16px;
                border: none;
                cursor: pointer;
                width: 100%;
            }
            .dropbtn:hover, .dropbtn:focus {
                background-color: #3e8e41;
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

        // ============ PERSON DROPDOWN SETUP ============

        const peopleDropdownBtn = document.getElementById("dropdown-people-button");
        const peopleDropdownContent = document.getElementById("myDropdown_people");
        const peopleMyInput = document.getElementById("myInput_people");
        const peopleLinks = peopleDropdownContent.getElementsByTagName("a");

        // Toggle dropdown when button is clicked
        peopleDropdownBtn.onclick = function(e) {
            e.preventDefault();
            peopleDropdownContent.classList.toggle("show");
            peopleMyInput.focus();
        };

        // Keep dropdown open while typing and filter results
        peopleMyInput.onkeyup = function() {
            peopleDropdownContent.classList.add("show");
            const filter = this.value.toUpperCase();

            for (let i = 0; i < peopleLinks.length; i++) {
                const text = peopleLinks[i].textContent || peopleLinks[i].innerText;
                if (text.toUpperCase().indexOf(filter) > -1) {
                    peopleLinks[i].style.display = "";
                } else {
                    peopleLinks[i].style.display = "none";
                }
            }
        };

        // Open dropdown when clicking on search input
        peopleMyInput.onclick = function(e) {
            e.stopPropagation();
            peopleDropdownContent.classList.add("show");
        };

        // Handle selecting a person from the list
        for (let i = 0; i < peopleLinks.length; i++) {
            peopleLinks[i].onclick = function(e) {
                e.preventDefault();
                selectedPerson = this.dataset.person;
                peopleDropdownBtn.innerText = this.textContent;
                peopleDropdownContent.classList.remove("show");
            };
        }

        // ============ EVENT DROPDOWN SETUP ============

        const dropdownBtn = document.getElementById("dropdown-button");
        const dropdownContent = document.getElementById("myDropdown");
        const myInput = document.getElementById("myInput");
        const eventLinks = dropdownContent.getElementsByTagName("a");

        // Toggle dropdown when button is clicked
        dropdownBtn.onclick = function(e) {
            e.preventDefault();
            dropdownContent.classList.toggle("show");
            myInput.focus();  // Focus on search input
        };

        // Keep dropdown open while typing and filter results
        myInput.onkeyup = function() {
            dropdownContent.classList.add("show");  // Ensure dropdown stays open
            const filter = this.value.toUpperCase();
            let hasVisibleItems = false;
            
            for (let i = 0; i < eventLinks.length; i++) {
                const text = eventLinks[i].textContent || eventLinks[i].innerText;
                if (text.toUpperCase().indexOf(filter) > -1) {
                    eventLinks[i].style.display = "";
                    hasVisibleItems = true;
                } else {
                    eventLinks[i].style.display = "none";
                }
            }
        };

        // Open dropdown when clicking on search input
        myInput.onclick = function(e) {
            e.stopPropagation();
            dropdownContent.classList.add("show");
        };

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
            showLogin();
        };

    } catch (error) {
        setContent(`
            <div class="card error">
                Error loading report screen: ${escapeHTML(error.message)}
            </div>
        `);
    }
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
                type="password"  <!-- type="password" hides the characters -->
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

            // Wrong password! Show error message
            document
                .getElementById(
                    "admin-error"
                )
                .innerText =
                    result.error;  // Show server's error message

            return;  // Stop here, don't continue
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
                type="number"  <!-- Only numbers allowed -->
                min="0"  <!-- Can't be negative -->
                value="${getDistribution(
                    people
                ).low}"  <!-- Start with current distribution -->
            >


            <!-- Input for MID category target -->
            <label>
                Mid  <!-- Category label -->
                <small>
                    1001 to 2000  <!-- Score range for this category -->
                </small>
            </label>

            <!-- Number input to set target count for MID -->
            <input
                id="target-mid"
                type="number"
                min="0"
                value="${getDistribution(
                    people
                ).mid}"  <!-- Start with current distribution -->
            >


            <!-- Input for HIGH category target -->
            <label>
                High  <!-- Category label -->
                <small>
                    2001+  <!-- Score range for this category -->
                </small>
            </label>

            <!-- Number input to set target count for HIGH -->
            <input
                id="target-high"
                type="number"
                min="0"
                value="${getDistribution(
                    people
                ).high}"  <!-- Start with current distribution -->
            >


            <!-- Duration setting -->
            <label>
                Adjustment duration  <!-- How long to run the adjustment -->
                <small>
                    minutes  <!-- Unit: minutes -->
                </small>
            </label>

            <!-- Number input for duration -->
            <input
                id="duration"
                type="number"
                min="1"  <!-- At least 1 minute -->
                value="180"  <!-- Default: 180 minutes (3 hours) -->
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