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

    if(action === "member_basic"){
      return getMemberBasic(params.citizenship_id);
    }

    if (action === "member_events") {
      return getMemberEvents(params.citizenship_id)
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
    reasons_version: Number(
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

function getMemberBasic(citizenshipId) {
  if (!citizenshipId) {
    return jsonResponse({
      success: false,
      error: "Missing citizenship ID"
    });
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = "member_basic_" + String(citizenshipId);

  const cached = cache.get(cacheKey);

  if (cached) {
    return jsonResponse(JSON.parse(cached));
  }

  const peopleSheet = getSheet(PEOPLE_SHEET);
  const people = peopleSheet.getDataRange().getValues();

  for (let i = 1; i < people.length; i++) {
    if (
      String(people[i][0]).trim() === String(citizenshipId).trim()
    ){
      const result = {
        success: true,
        person: {
          citizenship_id: String(people[i][0]),
          name: String(people[i][1]),
          score: Number(people[i][2])
        }
      };

      cache.put(
        cacheKey,
        JSON.stringify(result),
        300
      );

      return jsonResponse(result);
    }
  }

  return jsonResponse({
    success: false,
    error: "Citizenship ID not found"
  });
}

function getMemberEvents(citizenshipId) {
  if (!citizenshipId) {
    return jsonResponse({
      success:false,
      error: "Missing citizenship ID"
  });
  }

  const normalizedId = String(citizenshipId).trim();
  const cache = CacheService.getScriptCache();
  const cacheKey = "member_events_" + normalizedId;

  const cached = cache.get(cacheKey);

  if (cached) {
    return jsonResponse(JSON.parse(cached));
  }

  const eventsSheet = getSheet(EVENTS_SHEET);

  const values = eventsSheet.getDataRange().getValues();

  const memberEvents = [];

  for (let i = 1; i < values.length; i++) {
    if (
      String(values[i][1]).trim() === normalizedId
    ){
      memberEvents.push({
        event_id: String(values[i][0]),
        reason: String(values[i][2]),
        points: Number(values[i][3]),
        timestamp: String(values[i][5]),
        event_type: String(values[i][6])
      });
    }
  }

  const result = {
    success: true,
    events: memberEvents
  };

  cache.put(
    cacheKey,
    JSON.stringify(result),
    300
  );

  return jsonResponse(result);
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

  const started = Date.now();

  Logger.log("REPORT START:",
  new Date(started).toISOString());

  Logger.log("person: " + person);
  Logger.log("event: " + event);

  const cache = CacheService.getScriptCache()

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

  Logger.log(
    "AFTER PEOPLE:",
    Date.now() - started,
    "ms"
  );

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

  Logger.log("ADTER REASONS: ",
  Date.now() - started,
  "ms"
  );

  const newScore = oldScore + points;

  peopleSheet
    .getRange(row, 3)
    .setValue(newScore);

  Logger.log(
    "AFTER SCORE WRITE: ",
    Date.now() - started,
    "ms"
  );

  CacheService.getScriptCache()
    .remove("member_basic_" + personsCitizenshipId);

  CacheService.getScriptCache()
    .remove("member_events_" + personsCitizenshipId);

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

  Logger.log(
    "AFTER EVENT WRITE: ",
    Date.now() - started,
    "ms"
  );

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

  CacheService.getScriptCache()
    .remove("member_basic_" + target);
  
  CacheService.getScriptCache()
    .remove("member_events_" + target);


  const eventsSheet =
    getSheet(EVENTS_SHEET);


  const eventId =
    Utilities.getUuid();


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