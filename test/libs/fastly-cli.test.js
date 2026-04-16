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

const assert = require('assert');
const FastlyCli = require('../../src/libs/fastly-cli');

describe('FastlyCli', function () {
  describe('#ensureServiceIdIsSafe', function () {
    it('should accept a valid service name', function () {
      const fastlyCli = new FastlyCli();
      fastlyCli.ensureServiceIdIsSafe('first-function');
      assert.ok(true);
    });

    it('should accept a single lowercase letter', function () {
      const fastlyCli = new FastlyCli();
      fastlyCli.ensureServiceIdIsSafe('a');
      assert.ok(true);
    });

    it('should accept a name at exactly 30 characters', function () {
      const fastlyCli = new FastlyCli();
      fastlyCli.ensureServiceIdIsSafe('abcdefghijklmnopqrstuvwxyz1234');
      assert.ok(true);
    });

    it('should reject a name exceeding 30 characters', function () {
      const fastlyCli = new FastlyCli();
      assert.throws(function () {
        fastlyCli.ensureServiceIdIsSafe('abcdefghijklmnopqrstuvwxyz12345');
      }, /Service name must be 1-30 characters long/);
    });

    it('should reject names with special characters', function () {
      const fastlyCli = new FastlyCli();
      assert.throws(function () {
        fastlyCli.ensureServiceIdIsSafe('!xyz!');
      }, /Invalid service name/);
    });

    it('should reject names with uppercase letters', function () {
      const fastlyCli = new FastlyCli();
      assert.throws(function () {
        fastlyCli.ensureServiceIdIsSafe('My-Function');
      }, /Invalid service name/);
    });

    it('should reject names starting with a digit', function () {
      const fastlyCli = new FastlyCli();
      assert.throws(function () {
        fastlyCli.ensureServiceIdIsSafe('1-function');
      }, /Invalid service name/);
    });

    it('should reject names ending with a hyphen', function () {
      const fastlyCli = new FastlyCli();
      assert.throws(function () {
        fastlyCli.ensureServiceIdIsSafe('my-function-');
      }, /Invalid service name/);
    });

    it('should reject empty string', function () {
      const fastlyCli = new FastlyCli();
      assert.throws(function () {
        fastlyCli.ensureServiceIdIsSafe('');
      }, /Invalid service name/);
    });

    it('should reject null', function () {
      const fastlyCli = new FastlyCli();
      assert.throws(function () {
        fastlyCli.ensureServiceIdIsSafe(null);
      }, /Invalid service name/);
    });

    it('should reject names with underscores', function () {
      const fastlyCli = new FastlyCli();
      assert.throws(function () {
        fastlyCli.ensureServiceIdIsSafe('my_function');
      }, /Invalid service name/);
    });
  });
});
