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
const PackageCommand = require('../../../../src/commands/aem/edge-functions/package');

const PACKAGE = {
  id: '42',
  active: true,
  name: 'my-aem-edge-function',
  description: 'My AEM Edge Function',
  size: 3955227,
  createdAt: '2026-05-13T08:35:01Z',
  filesHash: 'abc123def456'
};

describe('PackageCommand', () => {
  let sandbox;
  let command;
  let mockGet;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    command = new PackageCommand([], {});
    command.flags = { debug: false };
    command.args = { serviceId: 'my-function', packageId: '42' };
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
    assert.ok(PackageCommand.description.includes('package'));
  });

  it('should define debug flag with -d shorthand', () => {
    assert.strictEqual(PackageCommand.flags.debug.char, 'd');
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

  it('displays package details', async () => {
    mockGet.resolves({ ok: true, json: async () => PACKAGE });

    const logged = [];
    const origLog = console.log;
    console.log = (...args) => logged.push(args.join(' '));
    try {
      await command.run();
    } finally {
      console.log = origLog;
    }

    const output = logged.join('\n');
    assert.ok(output.includes('my-aem-edge-function'));
    assert.ok(output.includes('My AEM Edge Function'));
    assert.ok(output.includes('42'));
    assert.ok(output.includes('3862.5 KB'));
    assert.ok(output.includes('abc123def456'));
  });

  it('calls the correct API path', async () => {
    mockGet.resolves({ ok: true, json: async () => PACKAGE });

    const logged = [];
    const origLog = console.log;
    console.log = (...args) => logged.push(args.join(' '));
    try {
      await command.run();
    } finally {
      console.log = origLog;
    }

    const [calledPath] = mockGet.firstCall.args;
    assert.strictEqual(calledPath, '/edgeFunctions/my-function/packages/42');
  });

  it('errors on API failure using problem detail', async () => {
    mockGet.resolves({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Package not found' }),
      headers: { get: () => null }
    });

    await assert.rejects(() => command.run(), /command error/);
    assert.ok(command.error.calledWith(sinon.match(/Package not found/)));
  });

  it('falls back to title when detail is absent', async () => {
    mockGet.resolves({
      ok: false,
      status: 403,
      json: async () => ({ title: 'Forbidden' }),
      headers: { get: () => null }
    });

    await assert.rejects(() => command.run(), /command error/);
    assert.ok(command.error.calledWith(sinon.match(/Forbidden/)));
  });

  it('includes request-id in the error when present', async () => {
    mockGet.resolves({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Internal error' }),
      headers: { get: (h) => (h === 'x-request-id' ? 'req-xyz' : null) }
    });

    await assert.rejects(() => command.run(), /command error/);
    assert.ok(command.error.calledWith(sinon.match(/req-xyz/)));
  });

  it('logs the API endpoint when --debug is set', async () => {
    command.flags.debug = true;
    mockGet.resolves({ ok: true, json: async () => PACKAGE });

    const logged = [];
    const origLog = console.log;
    console.log = (...args) => logged.push(args.join(' '));
    try {
      await command.run();
    } finally {
      console.log = origLog;
    }

    assert.ok(logged.some((msg) => msg.includes('edgeFunctions/my-function/packages/42')));
  });
});
