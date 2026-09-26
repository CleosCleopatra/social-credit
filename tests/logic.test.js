import { describe, expect, test } from "vitest";
import {getDistribution, getInterval} from "../google-apps-script-code/logic.js";

describe("getInterval", () =>{
    test.each([
        [0, "low"],
        [1000, "low"],
        [1001, "mid"],
        [2000, "mid"],
        [2001, "high"],
        [5000, "high"],
        [-100, "low"]
    ])(
        "score %s belongs to %s",
        (score, expected) => {
            expect(getInterval(score)).toBe(expected);
        }
    );
});

describe("getDistribution", () =>{
    test("counts every person exactly once", () => {
        const people = [
            {score: 0},
            {score: -111},
            {score: 1001},
            {score: 2000},
            {score: 3000}
        ];
        
        const result = getDistribution(people);

        expect(result).toEqual({
            low: 2,
            mid: 2,
            high: 1
        });

        expect(
            result.low + result.mid + result.high)
            .toBe(people.length);
});
});

