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
const PurgeCacheCommand = require('../../../../src/commands/aem/edge-functions/purge-cache');

describe('PurgeCacheCommand', () => {
  let command;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    command = new PurgeCacheCommand([], {});
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
    assert.ok(PurgeCacheCommand.description.includes('Purge cached content'));
  });

  it('should define serviceId as required arg', () => {
    assert.strictEqual(PurgeCacheCommand.args.serviceId.required, true);
  });

  it('should define surrogateKey flag as multiple', () => {
    assert.strictEqual(PurgeCacheCommand.flags.surrogateKey.char, 'k');
    assert.strictEqual(PurgeCacheCommand.flags.surrogateKey.multiple, true);
  });

  it('should define all flag as boolean', () => {
    assert.strictEqual(PurgeCacheCommand.flags.all.char, 'a');
  });

  it('should define soft flag as boolean', () => {
    assert.strictEqual(PurgeCacheCommand.flags.soft.char, 's');
  });

  it('should have examples', () => {
    assert.ok(PurgeCacheCommand.examples.length > 0);
  });

  it('should error when no purge mode specified', async () => {
    command.args = { serviceId: 'my-func' };
    command.flags = { all: false };

    await assert.rejects(() => command.run(), /command error/);
    assert.ok(command.error.calledWith(sinon.match(/must specify one of/)));
  });

  it('should error when API endpoint is not configured', async () => {
    command.args = { serviceId: 'my-func' };
    command.flags = { all: true, soft: false };
    command.getApiBasePath = sandbox.stub().returns(null);

    await assert.rejects(() => command.run(), /command error/);
    assert.ok(command.error.calledWith(sinon.match(/not configured/)));
  });
});
