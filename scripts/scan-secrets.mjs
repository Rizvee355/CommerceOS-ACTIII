import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rules = [
  { name: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  {
    name: "github-fine-grained-token",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  },
  { name: "openai-style-token", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "aws-access-key", pattern: /\bAKIA[A-Z0-9]{16}\b/g },
  {
    name: "private-key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    name: "amd-token-factory-key-assignment",
    pattern:
      /AMD_TOKEN_FACTORY_API_KEY[ \t]*=[ \t]*["']?[A-Za-z0-9][A-Za-z0-9._-]{11,}/g,
  },
];

export const scanText = (file, content) =>
  rules
    .filter(({ pattern }) => {
      pattern.lastIndex = 0;
      return pattern.test(content);
    })
    .map(({ name }) => ({ file, rule: name }));

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const listReviewableFiles = () =>
  execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
    cwd: repositoryRoot,
    encoding: "buffer",
  })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);

const scanRepository = () => {
  const findings = [];

  for (const relativePath of listReviewableFiles()) {
    const absolutePath = resolve(repositoryRoot, relativePath);
    if (!existsSync(absolutePath)) continue;
    if (statSync(absolutePath).size > 2_000_000) continue;
    findings.push(
      ...scanText(relativePath, readFileSync(absolutePath, "utf8")),
    );
  }

  return findings;
};

const invokedDirectly =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const findings = scanRepository();
  if (findings.length > 0) {
    console.error("Potential secrets detected:");
    for (const finding of findings) {
      console.error(`- ${finding.file}: ${finding.rule}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Secret scan passed: no recognized credential patterns found.");
  }
}
