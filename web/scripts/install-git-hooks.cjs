const { execFileSync } = require("node:child_process");
const path = require("node:path");

// Hooks belong to local checkouts, not CI or production package installs.
if (!process.env.CI) {
  const repository = path.resolve(__dirname, "../..");
  execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"], { cwd: repository, stdio: "inherit" });
  console.log("Installed the shared pre-push test hook.");
}
