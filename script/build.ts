import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile, chmod, stat } from "fs/promises";
import { execSync } from "child_process";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "@google-cloud/storage",
  "@neondatabase/serverless",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memoizee",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "openid-client",
  "p-limit",
  "p-retry",
  "passport",
  "passport-local",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

// CJS shim that dynamically imports the ESM bundle
const CJS_SHIM = `// CJS shim to load ESM bundle - works with "type": "module" in package.json
(async () => {
  try {
    console.log('Starting server...');
    await import('./index.mjs');
    console.log('Server module loaded successfully');
  } catch (err) {
    console.error('Failed to start server:');
    console.error(err.stack || err.message || err);
    process.exit(1);
  }
})();
`;

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  // Build as ESM to match package.json "type": "module"
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: "dist/index.mjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
    banner: {
      js: `import { createRequire } from 'module'; import { fileURLToPath } from 'url'; import { dirname } from 'path'; const require = createRequire(import.meta.url); const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename);`,
    },
  });

  // Write CJS shim for npm start compatibility
  console.log("writing CJS shim...");
  await writeFile("dist/index.cjs", CJS_SHIM);

  // Bundle a standalone Node.js binary for the deployment container
  // The deployment container has NO node/npm in PATH
  console.log("bundling Node.js binary for deployment...");
  const NODE_VERSION = "20.18.1";
  const tarball = `node-v${NODE_VERSION}-linux-x64.tar.xz`;
  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${tarball}`;
  try {
    const nodeBinCheck = await stat("dist/node").catch(() => null);
    if (!nodeBinCheck) {
      execSync(`curl -sL "${url}" | tar -xJ --strip-components=2 -C dist "node-v${NODE_VERSION}-linux-x64/bin/node"`, {
        stdio: "inherit",
      });
      await chmod("dist/node", 0o755);
    }
    const ver = execSync("./dist/node --version", { encoding: "utf-8" }).trim();
    console.log(`bundled node ${ver}`);
  } catch (e: any) {
    console.error("failed to bundle node binary:", e.message);
    process.exit(1);
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
