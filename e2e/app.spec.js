import {test, expect} from "@playwright/test";

test("member can log in", async ({page}) => {
    await page.route("**/exec**", async route => {
        const url = new URL(route.request().url());
        const action = url.searchParams.get("action");

        if (action === "member"){
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    success: true,
                    person: {
                        citizenship_id: "test-1",
                        name: "Test citizen",
                        score: 1500
                    },
                    events: []
                })
            });
            return;
        }

        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                success:false,
                error: "Unhandled test action"
            })
        });
    });

    await page.goto("/index.html");

    await expect(
        page.getByText("Citizenship Identification")
    ).toBeVisible();

    await page
    .getByPlaceholder("ENTER CITIZENSHIP ID")
    .fill("test-1");

    await page
    .getByRole("button", {
        name: "VERIFY IDENTITY"
    }).click();

    await expect(
        page.getByText("Test Citizen")
    ).toBeVisible();

    await expect(
        page.getByText("1500")
    ).toBeVisible();
});