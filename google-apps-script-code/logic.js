export const LOW_MAX = 1000;
export const MID_MIN = 1001;
export const MID_MAX = 2000;
export const HIGH_MIN = 2001;

export function getInterval(score) {
  score = Number(score);

  if (score <= LOW_MAX) {
    return "low";
  }

  if (score >= MID_MIN && score <= MID_MAX) {
    return "mid";
  }

  return "high";
}

export function getDistribution(people) {
  const distribution = {
    low: 0,
    mid: 0,
    high: 0
  };

  for (const person of people) {
    distribution[getInterval(person.score)]++;
  }

  return distribution;
}

function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i> 0; i--) {
        const j = Math.floor(Math.random() * (i+1));

        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}


function usefulReasons(score, target, reasons) {
  const useful = [];

  for (const reason of reasons) {
    const newScore = score + reason.points;

    if (
      target === "low" &&
      score > LOW_MAX &&
      reason.points < 0 &&
      Math.abs(LOW_MAX - newScore) <
        Math.abs(LOW_MAX - score)
    ) {
      useful.push(reason);
    } else if (
      target === "high" &&
      score < HIGH_MIN &&
      reason.points > 0 &&
      Math.abs(HIGH_MIN - newScore) <
        Math.abs(HIGH_MIN - score)
    ) {
      useful.push(reason);
    } else if (target === "mid") {
      if (
        score < MID_MIN &&
        reason.points > 0 &&
        Math.abs(MID_MIN - newScore) <
          Math.abs(MID_MIN - score)
      ) {
        useful.push(reason);
      } else if (
        score > MID_MAX &&
        reason.points < 0 &&
        Math.abs(MID_MAX - newScore) <
          Math.abs(MID_MAX - score)
      ) {
        useful.push(reason);
      }
    }
  }
  return shuffle(useful);
}


function assignTargets(people, targetCounts) {
  const shuffled = shuffle(people);
  const assignments = [];
  let index = 0;

  for (let i = 0; i < targetCounts.low; i++) {
    assignments.push({
      person: shuffled[index++],
      target: "low"
    });
  }

  for (let i = 0; i < targetCounts.mid; i++) {
    assignments.push({
      person: shuffled[index++],
      target: "mid"
    });
  }

  for (let i = 0; i < targetCounts.high; i++) {
    assignments.push({
      person: shuffled[index++],
      target: "high"
    });
  }

  return assignments;
}



export function buildPlan(people, targetCounts, reasons) {
  const totalPeople = people.length;

  const totalTargets =
    targetCounts.low +
    targetCounts.mid +
    targetCounts.high;

  if (totalTargets !== totalPeople) {
    return {
      success: false,
      error:
        "Target distribution must contain exactly " +
        totalPeople +
        " people."
    };
  }

  if (!Array.isArray(reasons) || reasons.length === 0) {
    return {
      success: false,
      error: "No score adjustment reasons are available."
    };
  }

  for (let attempt = 0; attempt < 200; attempt++) {
    const assignments = assignTargets(
      people,
      targetCounts
    );

    const simulated = people.map(person => ({
      citizenship_id: person.citizenship_id,
      name: person.name,
      score: Number(person.score),
      target: null
    }));

    const byId = {};

    for (const person of simulated) {
      byId[person.citizenship_id] = person;
    }

    for (const assignment of assignments) {
      byId[
        assignment.person.citizenship_id
      ].target = assignment.target;
    }

    const plan = [];
    let failed = false;

    for (const person of simulated) {
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

        const possible = usefulReasons(
          person.score,
          person.target,
          reasons
        );

        if (possible.length === 0) {
          failed = true;
          break;
        }

        const crossing = possible.filter(reason => {
          const newScore =
            person.score + reason.points;

          return (
            getInterval(newScore) ===
            person.target
          );
        });

        const selected =
          crossing.length > 0
            ? crossing[
                Math.floor(
                  Math.random() *
                    crossing.length
                )
              ]
            : possible[
                Math.floor(
                  Math.random() *
                    possible.length
                )
              ];

        const oldScore = person.score;
        person.score += selected.points;

        plan.push({
          citizenship_id:
            person.citizenship_id,
          reason: selected.reason,
          points: selected.points,
          old_score: oldScore,
          new_score: person.score
        });
      }

      if (failed) {
        break;
      }
    }

    if (failed) {
      continue;
    }

    const finalDistribution = {
      low: 0,
      mid: 0,
      high: 0
    };

    for (const person of simulated) {
      finalDistribution[
        getInterval(person.score)
      ]++;
    }

    if (
      finalDistribution.low === targetCounts.low &&
      finalDistribution.mid === targetCounts.mid &&
      finalDistribution.high === targetCounts.high
    ) {
      return {
        success: true,
        plan
      };
    }
  }

  return {
    success: false,
    error:
      "Could not find a valid score adjustment using the available reasons."
  };
}