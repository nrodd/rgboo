import {
  renderApp,
  fillName,
  clickSubmit,
  submitName,
  expectPopup,
} from "./setup/test-utils";
import { test } from "./setup/test-extend";
import { http, HttpResponse } from "msw";
import { SetupWorker } from "msw/browser";

test("when the user provides a valid username then the form is submitted", async () => {
  await renderApp();
  await submitName("Jack Skellington");
  await expectPopup(/Your color will appear immediately!/);
});

test("when the user omits a username then the field is marked as required", async () => {
  await renderApp();
  await clickSubmit();
  await expectPopup(/Required/);
});

test("when the user provides a username that is too short then the field is marked as invalid", async () => {
  await renderApp();
  await submitName("Bob");
  await expectPopup(/Too short!/);
});

test("when the user provides a username that is too long then the field is marked as invalid", async () => {
  await renderApp();
  await fillName("Mr. Mayor of Halloweentown");
  await clickSubmit();
  await expectPopup(/Too long!/);
});

test("then it handles profanity error", async ({
  worker,
}: {
  worker: SetupWorker;
}) => {
  worker.use(
    http.post("*/api/color", () => {
      return HttpResponse.json(
        {
          code: "PROFANITY_DETECTED",
          error: "Username contains inappropriate language.",
        },
        { status: 400 },
      );
    }),
  );

  await renderApp();
  await submitName("Jack Skellington");
  await expectPopup(
    /Username contains inappropriate language. Please choose a different username./,
  );
});

test("then it handles 400 error", async ({
  worker,
}: {
  worker: SetupWorker;
}) => {
  worker.use(
    http.post("*/api/color", () => {
      return HttpResponse.json(
        {
          error: "",
        },
        { status: 400 },
      );
    }),
  );

  await renderApp();
  await submitName("Jack Skellington");
  await expectPopup(/Failed to submit color request. Please try again./);
});
