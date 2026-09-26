import {beforeEach, describe, expect, test} from "vitest"
import {JSDOM} from "jsdom";
import fs from "node:fs";

const appSource = fs.readFileSync(
    new URL("../app.js", import.meta.url),
    "utf8"
);

function loadApp(){
    const dom = new JSDOM(
        `
      <!doctype html>
      <html>
        <head></head>
        <body>
          <div id="content"></div>
        </body>
      </html>
    `,
    {
        url: "http://localhost",
        runScripts: "dangerously"
    }
    );

    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.localStorage = dom.window.localStorage;
    globalThis.sessionStorage = dom.window.sessionStorage;
    globalThis.confirm = () => true;
    globalThis.alert = () => {};

    dom.window.__RUN_APP__ =false;
    const script = dom.window.document.createElement("script");
    script.textContent = appSource;
    dom.window.document.body.appendChild(script);

    return dom;
}

beforeEach(() => {
    loadApp();
});

describe("score categories", () => {
    test("1000 is low", () => {
        expect(window.getScoreStatus(1000)).toContain("LOW");
    });

    test("1001 is acceptable", () => {
        expect(window.getScoreStatus(1001)).toContain("ACCEPTABLE");
    });

    test("2000 is acceptable", () => {
        expect(window.getScoreStatus(2000)).toContain("ACCEPTABLE");
    });

    test("2001 is exemplary", () => {
        expect(window.getScoreStatus(2001)).toContain("EXEMPLARY");
    });
});

describe("distribution", () => {
    test("counts how many citizens of each group", () =>{
        const people = [
            {score: 0},
            {score: 1000},
            {score: 1001}, 
            {score: 2000},
            {score: 2001},
        ];

        expect(window.getDistribution(people)).toEqual({
            low: 2,
            mid: 2,
            high: 1
        });
    });
});

describe("HTML escapint", () => {
    test("escapes dangerous HTML", () =>{
        const result = window.escapeHTML(
            `<img src=x onerror="alert(1)">`
        );

        expect(result).toBe(
            "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
        );
    });
});

describe("local storage", ()=> {
    test("saves and reads a citizenship ID", () => {
        window.saveID("citizen-123");
        expect(window.getSavedID()).toBe("citizen-123");
    });

    test("clears a citizenship ID", () => {
        window.saveID("citizen-123");
        window.clearID();

        expect(window.getSavedID()).toBeNull();
    });

    test("invalid cached data is discarded", () => {
        localStorage.setItem(
            "member_data_citizen-123",
            "not valid json"
        );

        expect(
            window.getCachedMember("citizen-123")
        ).toBeNull();

        expect(
            localStorage.getItem("member_data_citizen-123")
        ).toBeNull();
    });
});

