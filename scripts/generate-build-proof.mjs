import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const rootDir = process.cwd();
const configPath = join(rootDir, 'archtrainer.config.json');
const buildProofPath = join(rootDir, 'build_proof.json');
const playerSecret = process.env.ARCH_TRAINER_PLAYER_SECRET ?? '';

const hashedDirectories = ['src', 'server'];
const hashedFiles = ['index.html', 'package.json', 'tsconfig.json', 'tsconfig.server.json', 'vite.config.ts'];
const ignoredSegments = new Set(['node_modules', 'dist', 'data', 'env', '.git', '.github', 'coverage']);

await main();

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const repoFiles = await collectFiles();
  const buildHash = await hashFiles(repoFiles);

  const nextConfig = normalizeConfig({
    ...config,
    build_hash: buildHash,
  });

  const configHash = sha256(JSON.stringify(nextConfig));
  const generatedAt = new Date().toISOString();
  const buildId = sha256(`${buildHash}:${generatedAt}`).slice(0, 16);
  const signature = playerSecret
    ? sha256(`${playerSecret}:${buildHash}:${configHash}:${generatedAt}:${buildId}`)
    : '';

  const buildProof = {
    version: 1,
    build_hash: buildHash,
    config_hash: configHash,
    generated_at: generatedAt,
    build_id: buildId,
    files_hashed: repoFiles,
    signature,
  };

  await writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');
  await writeFile(buildProofPath, `${JSON.stringify(buildProof, null, 2)}\n`, 'utf8');

  console.log(`Prepared build proof ${buildId} for ${repoFiles.length} source files.`);
}

async function collectFiles() {
  const files = [];

  for (const filePath of hashedFiles) {
    files.push(filePath);
  }

  for (const directory of hashedDirectories) {
    files.push(...(await walk(join(rootDir, directory))));
  }

  return files.sort();
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredSegments.has(entry.name)) {
      continue;
    }

    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolutePath)));
      continue;
    }

    files.push(relative(rootDir, absolutePath));
  }

  return files;
}

async function hashFiles(files) {
  const hash = createHash('sha256');

  for (const filePath of files) {
    const content = await readFile(join(rootDir, filePath), 'utf8');
    hash.update(filePath);
    hash.update('\n');
    hash.update(content);
    hash.update('\n');
  }

  return hash.digest('hex');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeConfig(config) {
  return {
    config_version: 1,
    fork_name: String(config.fork_name ?? '').trim(),
    github_repo: String(config.github_repo ?? '').trim().replace(/\.git$/, '').replace(/^github\.com\//, '').replace(/^https:\/\/github\.com\//, ''),
    player_id: String(config.player_id ?? '').trim(),
    build_hash: String(config.build_hash ?? '').trim(),
    fork_signature: String(config.fork_signature ?? '').trim(),
    required_proof_file: String(config.required_proof_file ?? 'build_proof.json').trim(),
  };
}