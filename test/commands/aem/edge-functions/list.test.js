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
const ListCommand = require('../../../../src/commands/aem/edge-functions/list');

describe('ListCommand', () => {
  let command;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    command = new ListCommand([], {});
    command.flags = {};
    command.args = {};
    command.spinnerStart = sandbox.stub();
    command.spinnerStop = sandbox.stub();
    command.error = sandbox.stub().throws(new Error('command error'));
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should have correct description', () => {
    assert.ok(ListCommand.description.includes('List Edge Functions'));
  });

  it('should define debug flag', () => {
    assert.strictEqual(ListCommand.flags.debug.char, 'd');
  });

  it('should have examples', () => {
    assert.ok(ListCommand.examples.length > 0);
  });

  it('should error when no access token available', async () => {
    command.getAccessTokenAndStage = sandbox.stub().resolves({ accessToken: null, isStage: false });

    await assert.rejects(() => command.run(), /command error/);
    assert.ok(command.error.calledWith(sinon.match(/No access token/)));
  });

  it('should error when API endpoint is not configured', async () => {
    command.getAccessTokenAndStage = sandbox
      .stub()
      .resolves({ accessToken: 'token', isStage: false });
    command.getApiBasePath = sandbox.stub().returns(null);

    await assert.rejects(() => command.run(), /command error/);
    assert.ok(command.error.calledWith(sinon.match(/not configured/)));
  });

  it('should format date correctly', () => {
    const formatted = command.formatDate('2026-05-12T14:43:05Z');
    assert.ok(formatted.includes('2026'));
    assert.ok(formatted.includes('05'));
    assert.ok(formatted.includes('12'));
  });

  it('should handle invalid date gracefully', () => {
    const result = command.formatDate('not-a-date');
    assert.strictEqual(result, 'not-a-date');
  });
});
