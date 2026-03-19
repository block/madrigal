/**
 * Example: Build knowledge outputs using Madrigal programmatically.
 *
 * Run with: npx tsx examples/basic/build.ts
 */
import { build } from '../../src/index.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const result = await build({
    configPath: resolve(__dirname, 'madrigal.config.yaml'),
    baseDir: resolve(__dirname),
  });

  if (!result.success) {
    console.error('Build failed:');
    for (const warning of result.configWarnings) {
      console.error(`  - ${warning}`);
    }
    process.exit(1);
  }

  console.log(`Loaded ${result.totalUnits} knowledge unit(s)`);
  console.log(`Built ${result.results.length} output(s)\n`);

  for (const buildResult of result.results) {
    console.log(`--- ${buildResult.platform} (${buildResult.format}) ---`);
    console.log(`Units: ${buildResult.unitCount}`);
    console.log(buildResult.output);
    console.log('');
  }

  if (result.loadWarnings.length > 0) {
    console.log('Warnings:');
    for (const w of result.loadWarnings) {
      console.log(`  ${w.filePath}: ${w.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
