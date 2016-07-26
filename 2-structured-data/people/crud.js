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

var express = require('express');
var bodyParser = require('body-parser');
var config = require('../config');

function getModel () {
  return require('./model-' + config.get('DATA_BACKEND'));
}

var router = express.Router();

// Automatically parse request body as form data
router.use(bodyParser.urlencoded({ extended: false }));

// Set Content-Type for all responses for these routes
router.use(function (req, res, next) {
  res.set('Content-Type', 'text/html');
  next();
});

/**
 * GET /people/add
 *
 * Display a page of people (up to ten persons at a time).
 */
router.get('/', function list (req, res, next) {
  getModel().list(10, req.query.pageToken, function (err, entities, cursor) {
    if (err) {
      return next(err);
    }
    res.render('people/list.jade', {
      people: entities,
      nextPageToken: cursor
    });
  });
});

/**
 * GET /people/add
 *
 * Display a form for creating a person record.
 */
// [START add_get]
router.get('/add', function addForm (req, res) {
  res.render('people/form.jade', {
    person: {},
    action: 'Add'
  });
});
// [END add_get]

/**
 * POST /people/add
 *
 * Create a person record.
 */
// [START add_post]
router.post('/add', function insert (req, res, next) {
  var data = req.body;

  // Save the data to the database.
  getModel().create(data, function (err, savedData) {
    if (err) {
      return next(err);
    }
    res.redirect(req.baseUrl + '/' + savedData.id);
  });
});
// [END add_post]

/**
 * GET /people/:id/edit
 *
 * Display a person for editing.
 */
router.get('/:person/edit', function editForm (req, res, next) {
  getModel().read(req.params.person, function (err, entity) {
    if (err) {
      return next(err);
    }
    res.render('people/form.jade', {
      person: entity,
      action: 'Edit'
    });
  });
});

/**
 * POST /people/:id/edit
 *
 * Update a person.
 */
router.post('/:person/edit', function update (req, res, next) {
  var data = req.body;

  getModel().update(req.params.person, data, function (err, savedData) {
    if (err) {
      return next(err);
    }
    res.redirect(req.baseUrl + '/' + savedData.id);
  });
});

/**
 * GET /people/:id
 *
 * Display a person.
 */
router.get('/:person', function get (req, res, next) {
  getModel().read(req.params.person, function (err, entity) {
    if (err) {
      return next(err);
    }
    res.render('people/view.jade', {
      person: entity
    });
  });
});

/**
 * GET /people/:id/delete
 *
 * Delete a person.
 */
router.get('/:person/delete', function _delete (req, res, next) {
  getModel().delete(req.params.person, function (err) {
    if (err) {
      return next(err);
    }
    res.redirect(req.baseUrl);
  });
});

/**
 * Errors on "/people/*" routes.
 */
router.use(function handleRpcError (err, req, res, next) {
  // Format error and forward to generic error handler for logging and
  // responding to the request
  err.response = err.message;
  next(err);
});

module.exports = router;
