import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readlinkSync, renameSync, statSync, symlinkSync, unlinkSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);

const releaseRoot = resolve(String(args.get("release-root") || process.env.FRONTEND_RELEASE_ROOT || "/var/www/fair-meme-trade"));
const currentLink = resolve(String(args.get("current-link") || process.env.FRONTEND_CURRENT_LINK || join(releaseRoot, "current")));
const releasesDir = resolve(String(args.get("releases-dir") || process.env.FRONTEND_RELEASES_DIR || join(releaseRoot, "releases")));
const targetRelease = args.get("target") || process.env.ROLLBACK_TARGET_RELEASE || "";
const apiUrl = String(args.get("health-url") || process.env.PROD_HEALTH_URL || "https://english.xunlian.co/api/health");
const dryRun = args.has("dry-run") || process.env.DRY_RUN === "1";
const skipServiceChecks = args.has("skip-service-checks") || process.env.SKIP_SERVICE_CHECKS === "1";
const apiService = String(args.get("api-service") || process.env.FAIR_MEME_API_SERVICE || "fair-meme-api");
const indexerService = String(args.get("indexer-service") || process.env.FAIR_MEME_INDEXER_SERVICE || "fair-meme-indexer");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const run = (command, commandArgs) => {
  console.log(`$ ${[command, ...commandArgs].join(" ")}`);
  if (dryRun) return "";
  return execFileSync(command, commandArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
};

const getCurrentReleasePath = () => {
  if (!existsSync(currentLink)) return "";
  const currentStat = lstatSync(currentLink);
  if (currentStat.isSymbolicLink()) {
    return resolve(releaseRoot, readlinkSync(currentLink));
  }
  return currentStat.isDirectory() ? currentLink : "";
};

const getReleases = () => {
  assert(existsSync(releasesDir), `Releases directory does not exist: ${releasesDir}`);
  return readdirSync(releasesDir)
    .map((name) => ({ name, path: join(releasesDir, name) }))
    .filter((release) => statSync(release.path).isDirectory() && existsSync(join(release.path, "index.html")))
    .sort((left, right) => left.name.localeCompare(right.name));
};

const selectTarget = () => {
  const releases = getReleases();
  assert(releases.length > 0, `No valid releases with index.html found in ${releasesDir}`);

  if (targetRelease) {
    const target = releases.find((release) => release.name === targetRelease || release.path === resolve(String(targetRelease)));
    assert(target, `Target release not found: ${targetRelease}`);
    return target;
  }

  const currentPath = getCurrentReleasePath();
  const currentIndex = releases.findIndex((release) => resolve(release.path) === resolve(currentPath));
  assert(currentIndex > 0, `No previous release available before current release: ${currentPath || "(none)"}`);
  return releases[currentIndex - 1];
};

const checkHealth = async () => {
  if (dryRun) {
    console.log(`dry-run: would check ${apiUrl}`);
    return;
  }
  const response = await fetch(apiUrl);
  const text = await response.text();
  assert(response.ok, `${apiUrl} expected 2xx, got ${response.status}: ${text.slice(0, 200)}`);
  console.log(`${apiUrl} ${response.status}`);
};

const checkServices = () => {
  if (skipServiceChecks) return;
  run("systemctl", ["is-active", apiService, indexerService]);
};

const rollback = async () => {
  const currentPath = getCurrentReleasePath();
  const target = selectTarget();
  assert(resolve(target.path) !== resolve(currentPath), `Target release is already current: ${target.name}`);

  console.log(`current: ${currentPath || "(none)"}`);
  console.log(`target:  ${target.path}`);

  if (dryRun) {
    console.log(`dry-run: would point ${currentLink} to ${target.path}`);
  } else {
    const tmpLink = `${currentLink}.next`;
    if (existsSync(tmpLink)) unlinkSync(tmpLink);
    symlinkSync(target.path, tmpLink);
    renameSymlink(tmpLink, currentLink);
  }

  run("nginx", ["-t"]);
  run("systemctl", ["reload", "nginx"]);
  checkServices();
  await checkHealth();
  console.log(`rollback ok: ${basename(target.path)}`);
};

const renameSymlink = (from, to) => {
  if (existsSync(to)) unlinkSync(to);
  renameSync(from, to);
};

rollback().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
