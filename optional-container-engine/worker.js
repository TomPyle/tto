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

// Activate Google Cloud Trace and Debug when in production
if (process.env.NODE_ENV === 'production') {
  require('@google/cloud-trace').start();
  require('@google/cloud-debug');
}

var request = require('request');
var waterfall = require('async').waterfall;
var express = require('express');
var config = require('./config');

var logging = require('./lib/logging');
var images = require('./lib/images');
var background = require('./lib/background');

var model = require('./people/model-' + config.get('DATA_BACKEND'));

// When running on Google App Engine Managed VMs, the worker needs
// to respond to HTTP requests and can optionally supply a health check.
var app = express();

app.use(logging.requestLogger);

app.get('/_ah/health', function (req, res) {
  res.status(200).send('ok');
});

// Keep count of how many people this worker has processed
var personCount = 0;

app.get('/', function (req, res) {
  res.send('This worker has processed ' + personCount + ' people.');
});

app.use(logging.errorLogger);

function subscribe () {
  // Subscribe to Cloud Pub/Sub and receive messages to process person records.
  // The subscription will continue to listen for messages until the process
  // is killed.
  return background.subscribe(function (err, message) {
    // Any errors received are considered fatal.
    if (err) {
      throw err;
    }
    if (message.action === 'processPerson') {
      logging.info('Received request to process Person ' + message.personId);
      processPerson(message.personId);
    } else {
      logging.warn('Unknown request', message);
    }
  });
}

if (module === require.main) {
  var server = app.listen(config.get('PORT'), function () {
    var port = server.address().port;
    console.log('App listening on port %s', port);
  });
  subscribe();
}

// Processes a person by reading its existing data, attempting to find
// more information, and updating the database with the new information.
function processPerson (personId, callback) {
  if (!callback) {
    callback = logging.error;
  }
  waterfall([
    // Load the current data
    function (cb) {
      model.read(personId, cb);
    },
    // Find the information from Google
    findPersonInfo,
    // Save the updated data
    function (updated, cb) {
      model.update(updated.id, updated, false, cb);
    }
  ], function (err) {
    if (err) {
      logging.error('Error occurred', err);
      return callback(err);
    }
    logging.info('Updated person ' + personId);
    personCount += 1;
    callback();
  });
}

// Tries to find additional information about a person and updates
// the person's data. Also uploads a cover image to Cloud Storage
// if available.
function findPersonInfo (person, cb) {
  queryPeopleApi(person.email, function (err, r) {
    if (err) {
      return cb(err);
    }
    if (!r.items) {
      return cb('Not found');
    }
    var top = r.items[0];

    person.email = top.email;
    person.phone = top.phone;
    person.streetAddress  = top.streetAddress;
    person.city  = top.city;
    person.zipcode  = top.zipcode;
    person.lName  = top.lName;
    person.fName  = top.fName;
    person.description  = top.description;

    return cb(null, person);
  });
}

exports.app = app;
exports.processPerson = processPerson;
exports.findPersonInfo = findPersonInfo;
