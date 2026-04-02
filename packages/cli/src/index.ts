#!/usr/bin/env node
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import open from 'open';
import { createApp, createGitClient, validateRefs, createAutoSession } from '@git-reviewer/server';

const VERSION = '0.1.0';

/**
 * Probe for an existing git-reviewer server on the given port.
 * If found, register the repo with it and return true.
 */
async function tryRegisterWithExistingServer(port: number, repoPath: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const healthRes = await fetch(`http://localhost:${port}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!healthRes.ok) return false;
    const health = (await healthRes.json()) as { status?: string };
    if (health.status !== 'ok') return false;

    const registerRes = await fetch(`http://localhost:${port}/api/repos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoPath }),
    });

    return registerRes.ok;
  } catch {
    return false;
  }
}

const program = new Command();

program
  .name('git-reviewer')
  .description('Local code review tool with a GitHub PR-like web experience')
  .version(VERSION);

program
  .command('serve')
  .description('Start the git-reviewer web server for the given repository')
  .option('--base <ref>', 'Base ref for the diff (branch, tag, or commit SHA)')
  .option('--head <ref>', 'Head ref for the diff (defaults to HEAD)')
  .option('--uncommitted', 'Review uncommitted (working tree) changes', false)
  .option('--repo <path>', 'Path to the git repository to review', process.cwd())
  .option('--port <number>', 'Port to listen on', '3847')
  .option('--no-open', 'Do not automatically open the browser after starting')
  .option('--foreground', 'Run in foreground (do not detach)', false)
  .action(
    async (options: {
      base?: string;
      head?: string;
      uncommitted: boolean;
      repo: string;
      port: string;
      open: boolean;
      foreground: boolean;
    }) => {
      const repoPath = path.resolve(options.repo);
      const port = parseInt(options.port, 10);
      const git = createGitClient(repoPath);

      // Always validate refs and create session up front (visible errors)
      let baseCommit: string;
      let headCommit: string;

      try {
        const result = await validateRefs(git, {
          base: options.base,
          head: options.head,
          uncommitted: options.uncommitted,
        });
        baseCommit = result.baseCommit;
        headCommit = result.headCommit;
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }

      let sessionCommit: string;

      try {
        const session = await createAutoSession(git, {
          base: options.base,
          head: options.head,
          uncommitted: options.uncommitted,
          baseCommit,
          headCommit,
          repoPath,
        });
        sessionCommit = session.session.headCommit;

        if (!options.uncommitted && /^[a-f0-9]{7,}$/.test(session.session.headRef)) {
          console.warn(`Warning: HEAD is detached, using commit hash: ${session.session.headRef}`);
        }

        console.log(`Review session created: ${session.session.title} (${session.session.id})`);
      } catch (err) {
        console.error(
          `Error creating review session: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }

      const sessionUrl = `http://localhost:${port}/session/${sessionCommit}`;

      // ── Reuse existing server if one is already running ──
      const registered = await tryRegisterWithExistingServer(port, repoPath);
      if (registered) {
        console.log(`Server already running on port ${port}. Registered repo: ${repoPath}`);
        if (options.open) {
          await open(sessionUrl).catch(() => {});
        }
        process.exit(0);
      }

      // ── Background mode (default): spawn detached server and exit ──
      if (!options.foreground) {
        const scriptPath = fileURLToPath(import.meta.url);
        const childArgs = process.argv.slice(2).filter((a) => a !== '--foreground');
        childArgs.push('--foreground', '--no-open');

        const child = spawn(process.execPath, [scriptPath, ...childArgs], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();

        console.log(`git-reviewer v${VERSION} starting at http://localhost:${port}`);

        if (options.open) {
          await open(sessionUrl).catch(() => {});
        }

        process.exit(0);
      }

      // ── Foreground mode: run server in this process ──
      const thisDir = path.dirname(fileURLToPath(import.meta.url));
      const candidateStaticDir = path.resolve(thisDir, '../../server/public');
      const staticDir = existsSync(candidateStaticDir) ? candidateStaticDir : undefined;

      const app = createApp({ repoPath, staticDir });

      const server = app.listen(port, () => {
        console.log(`git-reviewer v${VERSION} running at http://localhost:${port}`);
        console.log(`Reviewing repo: ${repoPath}`);
        console.log(`Review session: ${sessionUrl}`);

        if (options.open) {
          open(sessionUrl).catch((err: unknown) => {
            console.warn(
              `Could not open browser: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
        }
      });

      server.on('error', async (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          // Another server may have just started — retry registration
          const retried = await tryRegisterWithExistingServer(port, repoPath);
          if (retried) {
            console.log(`Server already running on port ${port}. Registered repo: ${repoPath}`);
            if (options.open) {
              await open(sessionUrl).catch(() => {});
            }
            process.exit(0);
          }
          console.error(`Port ${port} is already in use. Use --port to specify a different port.`);
          process.exit(1);
        }
        throw err;
      });
    },
  );

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
