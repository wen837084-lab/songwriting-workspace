import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
const args = process.platform === "win32" ? ["/d", "/s", "/c", "pnpm build"] : ["build"];
const result = spawnSync(command, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_DESKTOP_STATIC: "true",
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
