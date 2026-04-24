/*
 * Copyright 2026 Adobe Inc. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

const { execFileSync, spawn } = require('child_process');

/**
 * Patterns for lines that should be hidden from customers because they
 * expose internal Fastly details irrelevant in the AEM Edge Functions context.
 * Matching is done against the plain text (ANSI codes stripped).
 */
const OUTPUT_FILTERS = [
  // "Manage this service at:" block with the manage.fastly.com URL
  /^Manage this service at:$/,
  /^\thttps:\/\/manage\.fastly\.com\//,
  // "View this service at:" block with internal compute backend URL
  /^View this service at:$/,
  /^\thttps:\/\/.*\.adobeaemcloud\.com/,
  // "A new version of the Fastly CLI is available" upgrade notice
  /^A new version of the Fastly CLI is available/,
  /^Current version:/,
  /^Latest version:/,
  /^Run `fastly update`/,
  // Fastly CLI bug report prompt
  /^If you believe this error is the result of a bug, please file an issue:/
];

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

/**
 * Spinner intermediate frame pattern.  When stdout is not a TTY the
 * Fastly CLI prints each spinner frame as a separate line, e.g.
 * "| Uploading package..." or "/ Activating service (version 31)...".
 */
const SPINNER_FRAME_RE = /^[|/\\\-] .+\.\.\.$/;

function stripAnsi(str) {
  return str.replace(ANSI_RE, '');
}

function shouldFilterLine(line) {
  const plain = stripAnsi(line);
  return OUTPUT_FILTERS.some((pattern) => pattern.test(plain)) || SPINNER_FRAME_RE.test(plain);
}

/**
 * Colorize the output to restore the green checkmarks that the Fastly
 * CLI would normally emit when writing to a TTY.  The ✓ character
 * becomes green (\x1b[32m✓\x1b[0m) and SUCCESS: becomes bold green.
 */
function colorize(line) {
  const plain = stripAnsi(line);
  // Don't double-colorize if ANSI codes are already present
  if (line !== plain) {
    return line;
  }
  line = line.replace(/✓/g, '\x1b[32m✓\x1b[0m');
  line = line.replace(/^(SUCCESS:)/, '\x1b[32m$1\x1b[0m');
  line = line.replace(/^(ERROR:)/, '\x1b[31m$1\x1b[0m');
  return line;
}

/**
 * Filter a complete output string by removing lines that match
 * OUTPUT_FILTERS / SPINNER_FRAME_RE and collapsing excessive blank lines.
 * Also re-applies terminal colors lost due to piping.
 */
function filterOutput(data) {
  const lines = data.split('\n');
  const filtered = lines.filter((line) => !shouldFilterLine(line));
  const result = [];
  for (const line of filtered) {
    if (line.trim() === '' && result.length > 0 && result[result.length - 1].trim() === '') {
      continue;
    }
    result.push(colorize(line));
  }
  return result.join('\n');
}

class FastlyCli {
  constructor(token, apiEndpoint) {
    this.fastlyCliPath = null;
    this.apiToken = token ?? process.env.AEM_COMPUTE_TOKEN;
    this.apiEndpoint =
      apiEndpoint ||
      process.env.AEM_COMPUTE_API_ENDPOINT ||
      'https://api-fastly.adobeaemcloud.com/';
  }

  async init() {
    const fastly = await import('@fastly/cli');
    this.fastlyCliPath = fastly.default;
  }

  ensureTokenIsSet() {
    if (!this.apiToken) {
      throw new Error('AEM_COMPUTE_TOKEN is not set');
    }
  }

  /**
   * Validate the service name against the Edge Functions configuration constraints.
   * Must be 1-30 lowercase alphanumeric/hyphen chars, starting with a letter, not ending with a hyphen.
   * This limit ensures the resulting backend hostname stays within the 63-octet DNS label limit
   * per RFC 1035, Section 3.1.
   */
  ensureServiceIdIsSafe(serviceId) {
    const SERVICE_NAME_PATTERN = /^[a-z]([a-z0-9-]{0,28}[a-z0-9])?$/;
    if (!serviceId || !SERVICE_NAME_PATTERN.test(serviceId)) {
      throw new Error(
        `Invalid service name: '${serviceId}'. ` +
          'Service name must be 1-30 characters long, start with a lowercase letter, ' +
          'end with a lowercase letter or digit, and contain only lowercase letters, digits, and hyphens.'
      );
    }
  }

  async run(args, { filterOutput: shouldFilter = false } = {}) {
    if (!this.fastlyCliPath) {
      await this.init();
    }
    const env = {
      ...process.env,
      FASTLY_API_TOKEN: this.apiToken,
      FASTLY_API_ENDPOINT: this.apiEndpoint
    };

    if (!shouldFilter) {
      execFileSync(this.fastlyCliPath, args, { stdio: 'inherit', env });
      return;
    }

    // We need to pipe stdout to filter out unwanted lines, but this means
    // the child process loses TTY detection (no colors, no live spinners).
    // To compensate we:
    //   - Show our own spinner while the command runs (using ora-classic)
    //   - Re-apply green coloring to ✓ and SUCCESS lines after filtering
    const ora = require('ora-classic');
    const spinner = ora({ text: 'Deploying...', color: 'cyan' }).start();

    return new Promise((resolve, reject) => {
      const child = spawn(this.fastlyCliPath, args, {
        env,
        stdio: ['inherit', 'pipe', 'pipe']
      });

      const stdoutChunks = [];
      const stderrChunks = [];

      child.stdout.on('data', (chunk) => stdoutChunks.push(chunk.toString()));
      child.stderr.on('data', (chunk) => stderrChunks.push(chunk.toString()));

      child.on('close', (code) => {
        spinner.stop();

        const stdout = stdoutChunks.join('');
        const stderr = stderrChunks.join('');

        if (stdout) {
          process.stdout.write(filterOutput(stdout));
        }
        if (stderr) {
          const filtered = filterOutput(stderr);
          if (filtered.trim()) {
            process.stderr.write(filtered);
          }
        }

        if (code !== 0) {
          reject(new Error(`Fastly CLI exited with code ${code}`));
        } else {
          resolve();
        }
      });

      child.on('error', (err) => {
        spinner.stop();
        reject(err);
      });
    });
  }

  async build() {
    await this.run(['compute', 'build', '--include-source']);
  }

  async deploy(serviceId, { debug = false } = {}) {
    this.ensureTokenIsSet();
    this.ensureServiceIdIsSafe(serviceId);
    await this.run(['compute', 'deploy', '--service-id', serviceId], { filterOutput: !debug });
  }

  async serve({ watch = false } = {}) {
    const args = ['compute', 'serve'];
    if (watch) {
      args.push('--watch');
    }
    await this.run(args);
  }

  async logTail(serviceId) {
    this.ensureTokenIsSet();
    this.ensureServiceIdIsSafe(serviceId);
    await this.run(['log-tail', '--service-id', serviceId]);
  }
}

module.exports = FastlyCli;
module.exports.filterOutput = filterOutput;
module.exports.shouldFilterLine = shouldFilterLine;
