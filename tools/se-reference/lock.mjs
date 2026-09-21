/**
 * A single-holder lock for corpus writes.
 *
 * Two harvesters running at once do not interleave — each reads the corpus at
 * startup, holds it in memory, and rewrites the whole file on every flush. The
 * second to flush silently discards everything the first found. Observed: two
 * concurrent runs took the corpus from 178 puzzles back to 163.
 *
 * `mkdir` is the primitive because it is atomic on every POSIX filesystem: it
 * either creates the directory or fails, with no window between checking and
 * creating. A lock file written with `existsSync` then `writeFileSync` has
 * exactly that window.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';

/** Treat a lock older than this as abandoned — a crashed run should not block forever. */
const STALE_MS = 30 * 60 * 1000;

export class CorpusLock {
  #dir;
  #held = false;

  constructor(name = 'corpus') {
    this.#dir = `.${name}.lock`;
  }

  /**
   * Take the lock, or throw explaining who holds it.
   *
   * Deliberately does not wait. A harvester that blocks looks identical to one
   * that is working, and the right response to "another run is going" is to
   * let it finish rather than queue behind it.
   */
  acquire() {
    try {
      mkdirSync(this.#dir);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;

      const info = this.#read();
      const age = info ? Date.now() - info.at : Infinity;

      if (info && age < STALE_MS && isAlive(info.pid)) {
        const mins = Math.round(age / 60000);
        throw new Error(
          `Another harvest is running (pid ${info.pid}, started ${mins}m ago).\n` +
            `Wait for it, or stop it with:  kill -INT ${info.pid}`,
        );
      }

      // Stale: the holder is gone, or it has been far too long.
      const why = info && !isAlive(info.pid) ? `pid ${info.pid} is gone` : 'lock expired';
      console.error(`Clearing stale lock (${why}).`);
      rmSync(this.#dir, { recursive: true, force: true });
      mkdirSync(this.#dir);
    }

    writeFileSync(`${this.#dir}/owner.json`, JSON.stringify({ pid: process.pid, at: Date.now() }));
    this.#held = true;
  }

  release() {
    if (!this.#held) return;
    rmSync(this.#dir, { recursive: true, force: true });
    this.#held = false;
  }

  #read() {
    try {
      const raw = readFileSync(`${this.#dir}/owner.json`, 'utf8');
      const parsed = JSON.parse(raw);
      return typeof parsed.pid === 'number' ? parsed : null;
    } catch {
      // A lock directory with no readable owner file is stale by definition.
      return null;
    }
  }

  /** Release on every exit path, including Ctrl-C and uncaught errors. */
  releaseOnExit() {
    const release = () => this.release();
    process.on('exit', release);
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
      process.on(signal, () => {
        release();
        process.exit(0);
      });
    }
    process.on('uncaughtException', (error) => {
      release();
      throw error;
    });
  }
}

/** Whether a pid is still running. Signal 0 checks without delivering. */
function isAlive(pid) {
  if (typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means it exists but belongs to someone else — still alive.
    return error.code === 'EPERM';
  }
}

export { existsSync };
