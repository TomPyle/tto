// Copyright 2015-2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

var extend = require('lodash').assign;
var mysql = require('mysql');
var config = require('../config');
var background = require('../lib/background');

function getConnection () {
  return mysql.createConnection(extend({
    database: 'trashtalk'
  }, {
    host: config.get('MYSQL_HOST'),
    user: config.get('MYSQL_USER'),
    password: config.get('MYSQL_PASSWORD')
  }));
}

function list (limit, token, cb) {
  token = token ? parseInt(token, 10) : 0;
  var connection = getConnection();
  connection.query(
    'SELECT * FROM `people` LIMIT ? OFFSET ?', [limit, token],
    function (err, results) {
      if (err) {
        return cb(err);
      }
      var hasMore = results.length === limit ? token + results.length : false;
      cb(null, results, hasMore);
    }
  );
  connection.end();
}

function listBy (userId, limit, token, cb) {
  token = token ? parseInt(token, 10) : 0;
  var connection = getConnection();
  connection.query(
    'SELECT * FROM `people` WHERE `createdById` = ? LIMIT ? OFFSET ?',
    [userId, limit, token],
    function (err, results) {
      if (err) {
        return cb(err);
      }
      var hasMore = results.length === limit ? token + results.length : false;
      cb(null, results, hasMore);
    });
  connection.end();
}

function create (data, queuePerson, cb) {
  var connection = getConnection();
  connection.query('INSERT INTO `people` SET ?', data, function (err, res) {
    if (err) {
      return cb(err);
    }
    if (queuePerson) {
      background.queuePerson(res.insertId);
    }
    read(res.insertId, cb);
  });
  connection.end();
}

function read (id, cb) {
  var connection = getConnection();
  connection.query(
    'SELECT * FROM `people` WHERE `id` = ?', id, function (err, results) {
      if (err) {
        return cb(err);
      }
      if (!results.length) {
        return cb({
          code: 404,
          message: 'Not found'
        });
      }
      cb(null, results[0]);
    });
  connection.end();
}

function update (id, data, queuePerson, cb) {
  var connection = getConnection();
  connection.query(
    'UPDATE `people` SET ? WHERE `id` = ?', [data, id], function (err) {
      if (err) {
        return cb(err);
      }
      if (queueBook) {
        background.queueBook(id);
      }
      read(id, cb);
    });
  connection.end();
}

function _delete (id, cb) {
  var connection = getConnection();
  connection.query('DELETE FROM `people` WHERE `id` = ?', id, cb);
  connection.end();
}

module.exports = {
  createSchema: createSchema,
  list: list,
  listBy: listBy,
  create: create,
  read: read,
  update: update,
  delete: _delete
};

if (module === require.main) {
  var prompt = require('prompt');
  prompt.start();

  console.log(
    'Running this script directly will allow you to initialize your mysql ' +
    'database.\n This script will not modify any existing tables.\n');

  prompt.get(['host', 'user', 'password'], function (err, result) {
    if (err) {
      return;
    }
    createSchema(result);
  });
}

function createSchema (config) {
  var connection = mysql.createConnection(extend({
    multipleStatements: true
  }, config));

  connection.query(
    'CREATE DATABASE IF NOT EXISTS `trashtalk` DEFAULT CHARACTER SET = ' +
    '\'utf8\' DEFAULT COLLATE \'utf8_general_ci\'; ' +
    'USE `trashtalk`; ' +
    'CREATE TABLE IF NOT EXISTS `trashtalk`.`people` ( ' +
    '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT, ' +
    '`email` VARCHAR(255) NULL, ' +
    '`lName` VARCHAR(255) NULL, ' +
    '`fName` VARCHAR(255) NULL, ' +
    '`phone` VARCHAR(255) NULL, ' +
    '`streetAddress` VARCHAR(255) NULL, ' +
    '`city` VARCHAR(255) NULL, ' +
    '`zip` VARCHAR(255) NULL, ' +
    '`joinDate` VARCHAR(255) NULL, ' +
    '`imageUrl` VARCHAR(255) NULL, ' +
    '`description` TEXT NULL, ' +
    '`createdBy` VARCHAR(255) NULL, ' +
    '`createdById` VARCHAR(255) NULL, ' +
    'PRIMARY KEY (`id`));',
    function (err) {
      if (err) {
        throw err;
      }
      console.log('Successfully created schema');
      connection.end();
    }
  );
}
