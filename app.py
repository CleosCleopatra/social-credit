from pyscript import document
from js import window, fetch
import json
import asyncio
import time

# =========================== =================================
# CONFIGURATION
# ============================================================
API_URL = "https://script.google.com/macros/s/AKfycbwN0WZVU3uh2-zXk6oVRbYGITbSP0OYyNaLPL4kbCU6CR-5xEC5IzQ0bjPjClApjNST/exec"

# ============================================================
# HTML HELPERS
# ============================================================

def html(content):
    return content


def set_content(content):

    document.querySelector("#content").innerHTML = content


def get_value(element_id):

    element = document.getElementById(element_id)

    return element.value


# ============================================================
# GOOGLE API
# ============================================================

async def api(action, params=None):
    if params is None: 
        params = {}

    params["action"] = action

    query = "&".join(
        f"{key}={window.encodeURIComponent(str(value))}"
        for key, value in params.items()
    )

    url = f"{API_URL}?{query}"

    print("Starting API request: ", url)
    start = time.time()

    response = await fetch(url)

    print(
        "FETCH FINISHED AFTER: ",
        round(time.time() - start, 2),
        "SECONDS"
    )

    text = await response.text()

    print("API STATUS:", response.status)
    print("API RESPONSE", text)


    """
    if params is None:
        params = {}

    params["action"] = action

    query = "&".join(
        f"{key}={window.encodeURIComponent(str(value))}"
        for key, value in params.items()
    )

    url = f"{API_URL}?{query}"

    response = await fetch(url)



    text = await response.text()

    print("API STATUS:", response.status)
    print("API RESPONSE:", text)

    """

    return json.loads(text)


# ============================================================
# LOCAL STORAGE
# ============================================================

def get_saved_id():

    return window.localStorage.getItem(
        "citizenship_id"
    )


def save_id(citizenship_id):

    window.localStorage.setItem(
        "citizenship_id",
        citizenship_id
    )


def clear_saved_id():

    window.localStorage.removeItem(
        "citizenship_id"
    )


# ============================================================
# STARTUP
# ============================================================

async def start():

    saved_id = get_saved_id()

    if saved_id:

        await show_member(saved_id)

    else:

        show_login()


# ============================================================
# MEMBER LOGIN
# ============================================================

def show_login():

    set_content("""

        <div class="card">

            <h2>Citizen identification</h2>

            <p>
                Enter your citizenship ID.
            </p>

            <input
                id="citizenship-input"
                placeholder="Citizenship ID"
            >

            <button
                id="login-button"
            >
                ENTER
            </button>

            <p
                id="login-error"
                class="error"
            ></p>

        </div>

        <div class="card">

            <button
                id="admin-button"
            >
                ADMIN MODE
            </button>

        </div>

    """)

    document.getElementById(
        "login-button"
    ).onclick = lambda event: asyncio.create_task(login())

    document.getElementById(
        "admin-button"
    ).onclick = lambda event: show_admin_login()

async def login():
    citizenship_id = get_value("citizenship-input").strip()

    if not citizenship_id:
        document.getElementById(
            "login-error"
        ).innerText = "Enter your citizenship ID."
        return

    set_content(
        "<div class='card'>Loading...</div>"
    )

    result = await api(
        "member",
        {
            "citizenship_id": citizenship_id
        }
    )

    if not result.get("success"):
        show_login()

        document.getElementById(
            "login-error"
        ).innerText = result.get(
            "error",
            "Something went wrong."
        )

        return

    save_id(citizenship_id)
    render_member(result)


# ============================================================
# MEMBER PAGE
# ============================================================

async def show_member(citizenship_id):

    set_content(
        "<div class='card'>Loading...</div>"
    )

    result = await api(
        "member",
        {
            "citizenship_id":
                citizenship_id
        }
    )

    if not result.get("success"):

        clear_saved_id()

        show_login()

        return

    render_member(result)


def render_member(data):

    person = data["person"]

    events = data["events"]


    score = person["score"]

    event_html = ""


    if not events:

        event_html = """
            <p class="small">
                No reports yet.
            </p>
        """

    else:

        # Most recent first

        events = list(reversed(events))


        for event in events:

            points = event["points"]

            css_class = (
                "positive"
                if points >= 0
                else "negative"
            )

            sign = (
                "+"
                if points >= 0
                else ""
            )


            event_html += f"""

                <div class="event">

                    <strong>
                        {event["reason"]}
                    </strong>

                    <span
                        class="{css_class}"
                    >
                        {sign}{points}
                    </span>

                    <div class="small">

                        {event["timestamp"]}

                    </div>

                </div>

            """


    set_content(f"""

        <div class="card">

            <h2>
                Welcome, {person["name"]}
            </h2>

            <div class="score">

                {score}

            </div>

            <div class="citizenship">

                Citizenship ID:
                {person["citizenship_id"]}

            </div>

        </div>


        <div class="card">

            <h2>
                Your reports
            </h2>

            {event_html}

        </div>


        <div class="card">

            <button
                id="refresh-button"
            >
                REFRESH
            </button>

            <button
                id="change-id-button"
            >
                CHANGE CITIZENSHIP ID
            </button>

        </div>

    """)


    document.getElementById(
        "refresh-button"
    ).onclick = lambda event: asyncio.create_task(
        show_member(person["citizenship_id"])
    )


    document.getElementById(
        "change-id-button"
    ).onclick = lambda event: change_id()


def change_id():

    clear_saved_id()

    show_login()


# ============================================================
# ADMIN LOGIN
# ============================================================

def show_admin_login():

    set_content("""

        <div class="card">

            <h2>
                Admin mode
            </h2>

            <input
                id="admin-password"
                type="password"
                placeholder="Admin password"
            >

            <button
                id="admin-login-button"
            >
                LOGIN
            </button>

            <p
                id="admin-error"
                class="error"
            ></p>

            <button
                id="back-button"
            >
                BACK
            </button>

        </div>

    """)


    document.getElementById(
        "admin-login-button"
    ).onclick = lambda event: asyncio.create_task(
        admin_login()
    )


    document.getElementById(
        "back-button"
    ).onclick = lambda event: show_login()


async def admin_login():

    password = get_value(
        "admin-password"
    )

    result = await api(
        "admin_login",
        {
            "password":
                password
        }
    )


    if not result.get("success"):

        document.getElementById(
            "admin-error"
        ).innerText = "Incorrect password."

        return


    await show_admin(password)


# ============================================================
# ADMIN DASHBOARD
# ============================================================

async def show_admin(password):

    result = await api(
        "admin_data",
        {
            "password":
                password
        }
    )


    if not result.get("success"):

        show_admin_login()

        return


    people = result["people"]


    # Store password only for this page session.
    window.sessionStorage.setItem(
        "admin_password",
        password
    )


    render_admin(
        people,
        password
    )


# ============================================================
# ADMIN DASHBOARD UI
# ============================================================

def render_admin(people, password):

    distribution = calculate_current_distribution(
        people
    )


    rows = ""


    for interval in distribution:

        rows += f"""

            <tr>

                <td>
                    {interval["min"]}
                    –
                    {interval["max"]}
                </td>

                <td>
                    {interval["count"]}
                </td>

            </tr>

        """


    set_content(f"""

        <div class="card">

            <h2>
                ADMIN MODE
            </h2>

            <p>

                <a
                    href="YOUR_GOOGLE_SHEET_URL"
                    target="_blank"
                >
                    Open Google Sheet
                </a>

            </p>

        </div>


        <div class="card">

            <h2>
                Current score distribution
            </h2>

            <table>

                <tr>
                    <th>Interval</th>
                    <th>People</th>
                </tr>

                {rows}

            </table>

        </div>


        <div class="card">

            <h2>
                Target score distribution
            </h2>

            <p class="small">

                Enter the desired number of
                people in each interval.

            </p>


            <div
                id="intervals"
            >

                <div class="interval-row">

                    <input
                        id="min-0"
                        value="0"
                        type="number"
                    >

                    <input
                        id="max-0"
                        value="99"
                        type="number"
                    >

                    <input
                        id="count-0"
                        value="0"
                        type="number"
                    >

                </div>


                <div class="interval-row">

                    <input
                        id="bad_min"
                        value="0"
                        type="number"
                    >

                    <input
                        id="bad_max"
                        value="1000"
                        type="number"
                    >

                    <input
                        id="count-bad"
                        value="0"
                        type="number"
                    >

                </div>


                <div class="interval-row">

                    <input
                        id="min-mid"
                        value="1001"
                        type="number"
                    >

                    <input
                        id="max-mid"
                        value="2000"
                        type="number"
                    >

                    <input
                        id="count-mid"
                        value="0"
                        type="number"
                    >

                </div>


                <div class="interval-row">

                    <input
                        id="min-high"
                        value="2001"
                        type="number"
                    >

                    <input
                        id="max-high"
                        value="3000"
                        type="number"
                    >

                    <input
                        id="count-high"
                        value="0"
                        type="number"
                    >

                </div>

            </div>


            <label>
                Adjustment duration (minutes)
            </label>

            <input
                id="duration"
                type="number"
                value="10"
                min="1"
            >


            <button
                id="adjust-button"
            >
                START SCORE ADJUSTMENT
            </button>

        </div>


        <div class="card">

            <h2>
                Live adjustment log
            </h2>

            <div
                id="change-log"
                class="change-log"
            >
                Waiting...
            </div>

        </div>


        <div class="card">

            <button
                id="admin-logout"
            >
                LOG OUT
            </button>

        </div>

    """)


    document.getElementById(
        "adjust-button"
    ).onclick = lambda event: asyncio.create_task(
        start_adjustment(password)
    )


    document.getElementById(
        "admin-logout"
    ).onclick = lambda event: show_login()


# ============================================================
# DISTRIBUTION
# ============================================================

def calculate_current_distribution(people):

    intervals = [

        {
            "min": 0,
            "max": 1000
        },

        {
            "min": 1001,
            "max": 2000
        },

        {
            "min": 2001,
            "max": 3000
        }

    ]


    for interval in intervals:

        interval["count"] = sum(

            1

            for person in people

            if (
                interval["min"]
                <= person["score"]
                <= interval["max"]
            )

        )


    return intervals


# ============================================================
# SCORE ADJUSTMENT
# ============================================================

def read_targets():

    targets = []


    for i in range(6):

        minimum = int(
            get_value(f"min-{i}")
        )

        maximum = int(
            get_value(f"max-{i}")
        )

        count = int(
            get_value(f"count-{i}")
        )


        if count > 0:

            targets.append({

                "min":
                    minimum,

                "max":
                    maximum,

                "count":
                    count

            })


    return targets


async def start_adjustment(password):

    targets = read_targets()


    if not targets:

        document.getElementById(
            "change-log"
        ).innerText = (
            "Enter at least one target interval."
        )

        return


    total_target = sum(
        target["count"]
        for target in targets
    )


    # We need the target numbers to equal
    # the number of people.

    result = await api(
        "admin_data",
        {
            "password":
                password
        }
    )


    if not result.get("success"):

        return


    people = result["people"]


    if total_target != len(people):

        document.getElementById(
            "change-log"
        ).innerText = (

            f"Your target contains "
            f"{total_target} people, "
            f"but there are "
            f"{len(people)} people."

        )

        return


    duration = int(
        get_value("duration")
    )


    if duration < 1:

        duration = 1


    # Number of changes required
    # is approximately the number
    # of people that need moving.

    current =calculate_current_distribution(people)


    difference = 0


    for target in targets:

        current_count = 0


        for interval in current:

            if (
                interval["min"]
                == target["min"]
                and
                interval["max"]
                == target["max"]
            ):

                current_count = interval["count"]


        difference += abs(
            current_count -
            target["count"]
        )


    # Each move fixes two distribution
    # problems, so divide by two.

    changes_needed = max(
        1,
        difference // 2
    )


    interval_seconds = (
        duration * 60
    ) / changes_needed


    log = document.getElementById(
        "change-log"
    )


    log.innerText = (
        "Starting adjustment...\n"
    )


    for step in range(changes_needed):

        result = await api(
            "adjust_scores",
            {
                "password":
                    password,

                "targets":
                    json.dumps(targets)
            }
        )


        if not result.get("success"):

            log.innerText += (
                "\nERROR: "
                + result.get(
                    "error",
                    "Unknown error"
                )
            )

            break


        if "change" in result:

            change = result["change"]


            sign = (
                "+"
                if change["points"] >= 0
                else ""
            )


            log.innerText += (

                f"\n"
                f"{change['name']} "
                f"({change['citizenship_id']}): "
                f"{sign}{change['points']} "
                f"→ {change['new_score']} "
                f"({change['reason']})"

            )


        await asyncio.sleep(
            interval_seconds
        )


    log.innerText += (
        "\n\nAdjustment finished."
    )


# ============================================================
# RUN
# ============================================================

asyncio.create_task(
    start()
)


              

          
    
