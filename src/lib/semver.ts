/** Minimal semver support for project versions in aip.json. */
export type Bump = "major" | "minor" | "patch";

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

export function isValidVersion(v: string): boolean {
  return SEMVER_RE.test(v);
}

/**
 * Compute the next version. `next` may be an explicit "x.y.z" or one of
 * major/minor/patch. Throws on an invalid current/explicit version.
 */
export function nextVersion(current: string | undefined, next: string): string {
  if (next === "major" || next === "minor" || next === "patch") {
    const base = current ?? "0.0.0";
    const m = base.match(SEMVER_RE);
    if (!m) throw new Error(`Current version "${base}" is not valid semver (x.y.z).`);
    let [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (next === "major") (major += 1), (minor = 0), (patch = 0);
    else if (next === "minor") (minor += 1), (patch = 0);
    else patch += 1;
    return `${major}.${minor}.${patch}`;
  }
  if (!isValidVersion(next)) {
    throw new Error(`"${next}" is not a valid version. Use x.y.z or major|minor|patch.`);
  }
  return next;
}

/** Compare two semver strings: -1 if a<b, 0 if equal, 1 if a>b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.match(SEMVER_RE);
  const pb = b.match(SEMVER_RE);
  if (!pa || !pb) return a.localeCompare(b);
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}
