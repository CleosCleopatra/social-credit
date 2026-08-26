const API_URL =
    "https://script.google.com/macros/s/AKfycbxzoS5ztPFjpq1LJFgTYGNPVgj61NEk1StDmDw3mV6uebbbiY1J4XW0WnMxD6YEQz2V/exec";

/* ============================================================
   API
============================================================ */

async function api(action, params = {}) {

    const query =
        new URLSearchParams({
            action: action,
            ...params
        });


    const response =
        await fetch(
            `${API_URL}?${query.toString()}`
        );


    const text =
        await response.text();


    console.log(
        "API:",
        action,
        response.status,
        text
    );


    if (!text.trim()) {

        throw new Error(
            "Google Apps Script returned an empty response."
        );
    }


    try {

        return JSON.parse(text);

    } catch (error) {

        throw new Error(
            "Google Apps Script did not return JSON:\n" +
            text.substring(0, 500)
        );
    }
}


/* ============================================================
   LOCAL STORAGE
============================================================ */

function getSavedID() {

    return localStorage.getItem(
        "citizenship_id"
    );
}


function saveID(id) {

    localStorage.setItem(
        "citizenship_id",
        id
    );
}


function clearID() {

    localStorage.removeItem(
        "citizenship_id"
    );
}


/* ============================================================
   HTML
============================================================ */

function setContent(html) {

    document
        .getElementById("content")
        .innerHTML = html;
}


/* ============================================================
   START
============================================================ */

async function start() {

    const id =
        getSavedID();


    if (id) {

        await showMember(id);

    } else {

        showLogin();
    }
}


/* ============================================================
   MEMBER LOGIN
============================================================ */

function showLogin() {

    setContent(`

        <div class="card">

            <h2>Citizen identification</h2>

            <p>
                Enter your citizenship ID.
            </p>

            <input
                id="citizenship-input"
                placeholder="Citizenship ID"
            >

            <button id="login-button">
                ENTER
            </button>

            <p
                id="login-error"
                class="error"
            ></p>

        </div>


        <div class="card">

            <button id="admin-button">
                ADMIN MODE
            </button>

        </div>
    `);


    document
        .getElementById("login-button")
        .onclick = login;


    document
        .getElementById("admin-button")
        .onclick = showAdminLogin;
}


async function login() {

    const id =
        document
            .getElementById(
                "citizenship-input"
            )
            .value
            .trim();


    if (!id) {

        document
            .getElementById(
                "login-error"
            )
            .innerText =
                "Enter your citizenship ID.";

        return;
    }


    setContent(`
        <div class="card">
            Loading...
        </div>
    `);


    try {

        const result =
            await api(
                "member",
                {
                    citizenship_id: id
                }
            );


        if (!result.success) {

            showLogin();

            document
                .getElementById(
                    "login-error"
                )
                .innerText =
                    result.error;

            return;
        }


        saveID(id);

        renderMember(result);

    } catch (error) {

        showLogin();

        document
            .getElementById(
                "login-error"
            )
            .innerText =
                error.message;
    }
}


/* ============================================================
   MEMBER
============================================================ */

async function showMember(id) {

    setContent(`
        <div class="card">
            Loading...
        </div>
    `);


    try {

        const result =
            await api(
                "member",
                {
                    citizenship_id: id
                }
            );


        if (!result.success) {

            clearID();

            showLogin();

            return;
        }


        renderMember(result);

    } catch (error) {

        setContent(`
            <div class="card error">
                ${escapeHTML(error.message)}
            </div>
        `);
    }
}


function renderMember(data) {

    const person =
        data.person;

    const events =
        [...data.events].reverse();


    let eventsHTML = "";


    if (events.length === 0) {

        eventsHTML =
            `<p class="small">
                No reports yet.
            </p>`;

    } else {

        eventsHTML =
            events.map(event => {

                const positive =
                    event.points >= 0;

                const sign =
                    positive ? "+" : "";


                return `

                    <div class="event">

                        <strong>
                            ${escapeHTML(
                                event.reason
                            )}
                        </strong>

                        <span class="${
                            positive
                                ? "positive"
                                : "negative"
                        }">

                            ${sign}${event.points}

                        </span>

                        <div class="small">
                            ${escapeHTML(
                                event.timestamp
                            )}
                        </div>

                    </div>
                `;

            }).join("");
    }


    setContent(`

        <div class="card">

            <h2>
                Welcome,
                ${escapeHTML(person.name)}
            </h2>

            <div class="score">
                ${person.score}
            </div>

            <div class="citizenship">

                Citizenship ID:
                ${escapeHTML(
                    person.citizenship_id
                )}

            </div>

        </div>


        <div class="card">

            <h2>
                Your reports
            </h2>

            ${eventsHTML}

        </div>


        <div class="card">

            <button id="refresh-button">
                REFRESH
            </button>

            <button id="change-id-button">
                CHANGE CITIZENSHIP ID
            </button>

        </div>
    `);


    document
        .getElementById(
            "refresh-button"
        )
        .onclick = () =>
            showMember(
                person.citizenship_id
            );


    document
        .getElementById(
            "change-id-button"
        )
        .onclick = () => {

            clearID();

            showLogin();
        };
}


/* ============================================================
   ADMIN LOGIN
============================================================ */

function showAdminLogin() {

    setContent(`

        <div class="card">

            <h2>
                Admin mode
            </h2>

            <input
                id="admin-password"
                type="password"
                placeholder="Admin password"
            >

            <button id="admin-login-button">
                LOGIN
            </button>

            <p
                id="admin-error"
                class="error"
            ></p>

            <button id="back-button">
                BACK
            </button>

        </div>
    `);


    document
        .getElementById(
            "admin-login-button"
        )
        .onclick = adminLogin;


    document
        .getElementById(
            "back-button"
        )
        .onclick = showLogin;
}


async function adminLogin() {

    const password =
        document
            .getElementById(
                "admin-password"
            )
            .value;


    try {

        const result =
            await api(
                "admin_login",
                {
                    password: password
                }
            );


        if (!result.success) {

            document
                .getElementById(
                    "admin-error"
                )
                .innerText =
                    result.error;

            return;
        }


        sessionStorage.setItem(
            "admin_password",
            password
        );


        await showAdmin(password);

    } catch (error) {

        document
            .getElementById(
                "admin-error"
            )
            .innerText =
                error.message;
    }
}


/* ============================================================
   ADMIN DASHBOARD
============================================================ */

async function showAdmin(password) {

    try {

        const result =
            await api(
                "admin_data",
                {
                    password: password
                }
            );


        if (!result.success) {

            showAdminLogin();

            return;
        }


        renderAdmin(
            result.people,
            result.adjustment,
            password
        );

    } catch (error) {

        setContent(`

            <div class="card error">

                ${escapeHTML(
                    error.message
                )}

            </div>
        `);
    }
}


function getDistribution(people) {

    const result = {

        low: 0,
        mid: 0,
        high: 0
    };


    people.forEach(person => {

        if (person.score <= 1000) {

            result.low++;

        } else if (
            person.score <= 2000
        ) {

            result.mid++;

        } else {

            result.high++;
        }
    });


    return result;
}


/* ============================================================
   ADMIN UI
============================================================ */

function renderAdmin(
    people,
    adjustment,
    password
) {

    const distribution =
        getDistribution(people);


    const running =
        adjustment &&
        adjustment.status === "RUNNING";


    setContent(`

        <div class="card">

            <h2>
                ADMIN MODE
            </h2>

            <p>
                Current distribution:
            </p>

            <div class="distribution">

                <div>
                    <strong>
                        ${distribution.low}
                    </strong>
                    <span>LOW</span>
                </div>

                <div>
                    <strong>
                        ${distribution.mid}
                    </strong>
                    <span>MID</span>
                </div>

                <div>
                    <strong>
                        ${distribution.high}
                    </strong>
                    <span>HIGH</span>
                </div>

            </div>

        </div>


        ${
            running
                ? renderRunningAdjustment(
                    adjustment,
                    password
                  )
                : renderAdjustmentForm(
                    people,
                    password
                  )
        }


        <div class="card">

            <button id="admin-refresh">
                REFRESH
            </button>

            <button id="admin-logout">
                LOG OUT
            </button>

        </div>
    `);


    document
        .getElementById(
            "admin-refresh"
        )
        .onclick = () =>
            showAdmin(password);


    document
        .getElementById(
            "admin-logout"
        )
        .onclick = () => {

            sessionStorage.removeItem(
                "admin_password"
            );

            showLogin();
        };


    if (!running) {

        document
            .getElementById(
                "start-adjustment"
            )
            .onclick = () =>
                startAdjustment(password);

    } else {

        document
            .getElementById(
                "stop-adjustment"
            )
            .onclick = () =>
                stopAdjustment(password);
    }
}


/* ============================================================
   ADJUSTMENT FORM
============================================================ */

function renderAdjustmentForm(
    people,
    password
) {

    return `

        <div class="card">

            <h2>
                Target distribution
            </h2>

            <p class="small">
                There are
                ${people.length}
                people.
            </p>


            <label>
                Low
                <small>
                    -∞ to 1000
                </small>
            </label>

            <input
                id="target-low"
                type="number"
                min="0"
                value="${getDistribution(
                    people
                ).low}"
            >


            <label>
                Mid
                <small>
                    1001 to 2000
                </small>
            </label>

            <input
                id="target-mid"
                type="number"
                min="0"
                value="${getDistribution(
                    people
                ).mid}"
            >


            <label>
                High
                <small>
                    2001+
                </small>
            </label>

            <input
                id="target-high"
                type="number"
                min="0"
                value="${getDistribution(
                    people
                ).high}"
            >


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


            <button id="start-adjustment">
                START SCORE ADJUSTMENT
            </button>

            <p
                id="adjustment-error"
                class="error"
            ></p>

        </div>
    `;
}


/* ============================================================
   RUNNING ADJUSTMENT
============================================================ */

function renderRunningAdjustment(
    adjustment,
    password
) {

    const total =
        adjustment.total_changes;

    const completed =
        adjustment.completed_changes;


    const percentage =
        total === 0
            ? 100
            : Math.round(
                completed /
                total *
                100
              );


    return `

        <div class="card">

            <h2>
                Adjustment in progress
            </h2>

            <div class="progress">

                <div
                    class="progress-bar"
                    style="width:${percentage}%"
                ></div>

            </div>

            <p>
                ${completed}
                /
                ${total}
                changes completed
            </p>

            <p>
                ${percentage}%
            </p>

            <p>
                Target:
            </p>

            <div class="distribution">

                <div>
                    <strong>
                        ${adjustment.target_low}
                    </strong>
                    <span>LOW</span>
                </div>

                <div>
                    <strong>
                        ${adjustment.target_mid}
                    </strong>
                    <span>MID</span>
                </div>

                <div>
                    <strong>
                        ${adjustment.target_high}
                    </strong>
                    <span>HIGH</span>
                </div>

            </div>


            <button
                id="stop-adjustment"
                class="danger"
            >
                STOP ADJUSTMENT
            </button>

        </div>
    `;
}


/* ============================================================
   START ADJUSTMENT
============================================================ */

async function startAdjustment(password) {

    const low =
        Number(
            document
                .getElementById(
                    "target-low"
                )
                .value
        );


    const mid =
        Number(
            document
                .getElementById(
                    "target-mid"
                )
                .value
        );


    const high =
        Number(
            document
                .getElementById(
                    "target-high"
                )
                .value
        );


    const duration =
        Number(
            document
                .getElementById(
                    "duration"
                )
                .value
        );


    const errorElement =
        document
            .getElementById(
                "adjustment-error"
            );


    errorElement.innerText =
        "Creating adjustment plan...";


    try {

        const result =
            await api(
                "start_adjustment",
                {
                    password:
                        password,

                    low:
                        low,

                    mid:
                        mid,

                    high:
                        high,

                    duration:
                        duration
                }
            );


        if (!result.success) {

            errorElement.innerText =
                result.error;

            return;
        }


        await showAdmin(password);


    } catch (error) {

        errorElement.innerText =
            error.message;
    }
}


/* ============================================================
   STOP
============================================================ */

async function stopAdjustment(password) {

    if (
        !confirm(
            "Stop the current adjustment?"
        )
    ) {
        return;
    }


    try {

        await api(
            "stop_adjustment",
            {
                password:
                    password
            }
        );


        await showAdmin(password);

    } catch (error) {

        alert(error.message);
    }
}


/* ============================================================
   ESCAPE HTML
============================================================ */

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* ============================================================
   AUTO REFRESH WHILE ADJUSTMENT IS RUNNING
============================================================ */

let adminRefreshTimer = null;


function startAdminPolling(password) {

    if (adminRefreshTimer) {

        clearInterval(
            adminRefreshTimer
        );
    }


    adminRefreshTimer =
        setInterval(
            async () => {

                try {

                    const result =
                        await api(
                            "admin_data",
                            {
                                password:
                                    password
                            }
                        );


                    if (
                        result.success
                    ) {

                        renderAdmin(
                            result.people,
                            result.adjustment,
                            password
                        );
                    }

                } catch (error) {

                    console.error(
                        error
                    );
                }

            },
            10000
        );
}


/* ============================================================
   RUN
============================================================ */

start();