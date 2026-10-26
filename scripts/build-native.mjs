import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const supportedBundles = new Set(["nsis", "msi"]);
const cliArgs = process.argv.slice(2);
const bundlesFlagIndex = cliArgs.indexOf("--bundles");
const requestedBundles = bundlesFlagIndex === -1
  ? ["nsis"]
  : (cliArgs[bundlesFlagIndex + 1] ?? "").split(",").filter(Boolean);

if (requestedBundles.length === 0 || requestedBundles.some((bundle) => !supportedBundles.has(bundle))) {
  throw new Error("--bundles must be a comma-separated list containing only nsis and/or msi.");
}

if (process.platform !== "win32" && requestedBundles.includes("msi")) {
  throw new Error("MSI bundles can only be built on Windows.");
}

const pnpmEntry = process.env.npm_execpath;
const defaultTargetDirectory = process.platform === "win32"
  ? "C:\\Users\\Public\\SongwritingWorkspaceBuild"
  : join(tmpdir(), "songwriting-workspace-build");
const targetDirectory = process.env.SONGWRITING_TAURI_TARGET_DIR ?? defaultTargetDirectory;
const cargoBinDirectory = join(homedir(), ".cargo", "bin");
const executablePath = existsSync(join(cargoBinDirectory, process.platform === "win32" ? "cargo.exe" : "cargo"))
  ? `${cargoBinDirectory}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`
  : process.env.PATH;
const configuredEndpoint = process.env.NEXT_PUBLIC_AI_COACH_ENDPOINT?.trim();
const configuredVersion = process.env.SONGWRITING_BUILD_VERSION?.trim();
let configOverridePath;

if (configuredVersion && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(configuredVersion)) {
  throw new Error("SONGWRITING_BUILD_VERSION must be a valid semantic version.");
}

function secureEndpointOrigin(value) {
  if (!value) return null;
  const endpoint = new URL(value);
  const isLocalDevelopment = endpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(endpoint.hostname);
  if (endpoint.protocol !== "https:" && !isLocalDevelopment) {
    throw new Error("NEXT_PUBLIC_AI_COACH_ENDPOINT must use HTTPS (HTTP is allowed only for local development).");
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("NEXT_PUBLIC_AI_COACH_ENDPOINT must not contain credentials, a query, or a fragment.");
  }
  return endpoint.origin;
}

const endpointOrigin = secureEndpointOrigin(configuredEndpoint);
if (endpointOrigin || configuredVersion) {
  const configOverride = {};

  if (configuredVersion) configOverride.version = configuredVersion;
  if (endpointOrigin) {
    configOverride.app = {
      security: {
        csp: `default-src 'self'; connect-src ipc: http://ipc.localhost ${endpointOrigin}; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`,
      },
    };
  }

  configOverridePath = join(tmpdir(), `songwriting-workspace-tauri-${process.pid}.json`);
  writeFileSync(configOverridePath, JSON.stringify(configOverride));
}

const pnpmCommand = pnpmEntry ? process.execPath : (process.platform === "win32" ? "cmd.exe" : "pnpm");
const directArgs = [
  "tauri",
  "build",
  "--no-sign",
  "--bundles",
  requestedBundles.join(","),
  ...(configOverridePath ? ["--config", configOverridePath] : []),
];
const pnpmArgs = pnpmEntry
  ? [pnpmEntry, ...directArgs]
  : (process.platform === "win32" ? ["/d", "/s", "/c", `pnpm ${directArgs.join(" ")}`] : directArgs);

let result;
try {
  result = spawnSync(pnpmCommand, pnpmArgs, {
    stdio: "inherit",
    env: {
      ...process.env,
      CARGO_TARGET_DIR: targetDirectory,
      PATH: executablePath,
    },
  });
} finally {
  if (configOverridePath) rmSync(configOverridePath, { force: true });
}

if (result.error) {
  throw result.error;
}

if (result.status === 0) {
  const releaseDirectory = join(targetDirectory, "release");
  const bundleDirectory = join(releaseDirectory, "bundle");
  const expectedArtifacts = [join(releaseDirectory, "songwriting-workspace.exe")];

  for (const bundle of requestedBundles) {
    const bundlePath = join(bundleDirectory, bundle);
    const extension = bundle === "nsis" ? ".exe" : ".msi";
    const artifact = existsSync(bundlePath)
      ? readdirSync(bundlePath)
          .map((name) => join(bundlePath, name))
          .filter((path) => statSync(path).isFile() && path.toLowerCase().endsWith(extension))
          .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0]
      : undefined;

    if (!artifact) throw new Error(`Tauri reported success but no ${bundle.toUpperCase()} artifact was found.`);
    expectedArtifacts.push(artifact);
  }

  console.log("Unsigned Windows release artifacts:");
  for (const artifact of expectedArtifacts) {
    const digest = createHash("sha256").update(readFileSync(artifact)).digest("hex").toUpperCase();
    console.log(`- ${artifact}`);
    console.log(`  SHA-256 ${digest}`);
  }
}

process.exit(result.status ?? 1);
