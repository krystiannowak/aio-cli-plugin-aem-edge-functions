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

'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { Request } = require('../../../../src/libs/request');
const PackagesCommand = require('../../../../src/commands/aem/edge-functions/packages');

const PACKAGES = [
  { packageId: '42', active: true, createdAt: '2026-05-13T08:35:01Z' },
  { packageId: '41', active: false, createdAt: '2026-05-06T14:45:35Z' }
];

describe('PackagesCommand', () => {
  let sandbox;
  let command;
  let mockGet;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    command = new PackagesCommand([], {});
    command.flags = { debug: false };
    command.args = { serviceId: 'my-function' };
    command.spinnerStart = sandbox.stub();
    command.spinnerStop = sandbox.stub();
    command.error = sandbox.stub().throws(new Error('command error'));
    command.getAccessTokenAndStage = sandbox
      .stub()
      .resolves({ accessToken: 'test-token', isStage: false });
    command.getApiBasePath = sandbox.stub().returns('https://example.com/cdn');

    mockGet = sandbox.stub(Request.prototype, 'get');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should have correct description', () => {
    assert.ok(PackagesCommand.description.includes('List'));
  });

  it('should define debug, limit, and cursor flags', () => {
    assert.strictEqual(PackagesCommand.flags.debug.char, 'd');
    assert.strictEqual(PackagesCommand.flags.limit.char, 'l');
    assert.strictEqual(PackagesCommand.flags.cursor.char, 'c');
  });

  it('errors when no access token available', async () => {
    command.getAccessTokenAndStage.resolves({ accessToken: null, isStage: false });

    await assert.rejects(() => command.run(), /command error/);
    assert.ok(command.error.calledWith(sinon.match(/No access token/)));
  });

  it('errors when API endpoint is not configured', async () => {
    command.getApiBasePath.returns(null);

    await assert.rejects(() => command.run(), /command error/);
    assert.ok(command.error.calledWith(sinon.match(/not configured/)));
  });

  it('prints a message when no packages found', async () => {
    mockGet.resolves({ ok: true, json: async () => ({ items: [] }) });

    const logged = [];
    const origLog = console.log;
    console.log = (...args) => logged.push(args.join(' '));
    try {
      await command.run();
    } finally {
      console.log = origLog;
    }

    assert.ok(logged.some((msg) => msg.includes('No packages found')));
  });

  it('displays packages in a table', async () => {
    mockGet.resolves({ ok: true, json: async () => ({ items: PACKAGES }) });

    const logged = [];
    const origLog = console.log;
    console.log = (...args) => logged.push(args.join(' '));
    try {
      await command.run();
    } finally {
      console.log = origLog;
    }

    const output = logged.join('\n');
    assert.ok(output.includes('42'));
    assert.ok(output.includes('41'));
    assert.ok(output.includes('yes'));
    assert.ok(output.includes('2 package(s)'));
  });

  it('appends limit and cursor query parameters', async () => {
    command.flags.limit = 5;
    command.flags.cursor = 'abc123';
    mockGet.resolves({ ok: true, json: async () => ({ items: PACKAGES }) });

    const logged = [];
    const origLog = console.log;
    console.log = (...args) => logged.push(args.join(' '));
    try {
      await command.run();
    } finally {
      console.log = origLog;
    }

    const [calledPath] = mockGet.firstCall.args;
    assert.ok(calledPath.includes('limit=5'));
    assert.ok(calledPath.includes('cursor=abc123'));
  });

  it('shows next cursor hint when response includes a cursor', async () => {
    mockGet.resolves({
      ok: true,
      json: async () => ({ items: PACKAGES, cursor: 'next-page-token' })
    });

    const logged = [];
    const origLog = console.log;
    console.log = (...args) => logged.push(args.join(' '));
    try {
      await command.run();
    } finally {
      console.log = origLog;
    }

    assert.ok(logged.some((msg) => msg.includes('next-page-token')));
  });

  it('errors on API failure using problem detail', async () => {
    mockGet.resolves({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Edge function not found' }),
      headers: { get: () => null }
    });

    await assert.rejects(() => command.run(), /command error/);
    assert.ok(command.error.calledWith(sinon.match(/Edge function not found/)));
  });

  it('logs the API endpoint when --debug is set', async () => {
    command.flags.debug = true;
    mockGet.resolves({ ok: true, json: async () => ({ items: PACKAGES }) });

    const logged = [];
    const origLog = console.log;
    console.log = (...args) => logged.push(args.join(' '));
    try {
      await command.run();
    } finally {
      console.log = origLog;
    }

    assert.ok(logged.some((msg) => msg.includes('edgeFunctions/my-function/packages')));
  });
});
