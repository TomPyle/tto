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
var config = require('../config');
var images = require('../lib/images');
var oauth2 = require('../lib/oauth2');

function getModel () {
  return require('./model-' + config.get('DATA_BACKEND'));
}

var router = express.Router();

// Use the oauth middleware to automatically get the user's profile
// information and expose login/logout URLs to templates.
router.use(oauth2.template);

// Set Content-Type for all responses for these routes
router.use(function (req, res, next) {
  res.set('Content-Type', 'text/html');
  next();
});

/**
 * GET /people/add
 *
 * Display a page of people (up to ten at a time).
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

// Use the oauth2.required middleware to ensure that only logged-in users
// can access this handler.
router.get('/mine', oauth2.required, function list (req, res, next) {
  getModel().listBy(
    req.user.id,
    10,
    req.query.pageToken,
    function (err, entities, cursor, apiResponse) {
      if (err) {
        return next(err);
      }
      res.render('people/list.jade', {
        people entities,
        nextPageToken: cursor
      });
    }
  );
});

/**
 * GET /people/add
 *
 * Display a form for creating a person.
 */
router.get('/add', function addForm (req, res) {
  res.render('people/form.jade', {
    people: {},
    action: 'Add'
  });
});

/**
 * POST /people/add
 *
 * Create a person.
 */
// [START add]
router.post(
  '/add',
  images.multer.single('image'),
  images.sendUploadToGCS,
  function insert (req, res, next) {
    var data = req.body;

    // If the user is logged in, set them as the creator of the person.
    if (req.user) {
      data.createdBy = req.user.displayName;
      data.createdById = req.user.id;
    } else {
      data.createdBy = 'Anonymous';
    }

    // Was an image uploaded? If so, we'll use its public URL
    // in cloud storage.
    if (req.file && req.file.cloudStoragePublicUrl) {
      data.imageUrl = req.file.cloudStoragePublicUrl;
    }

    // Save the data to the database.
    getModel().create(data, true, function (err, savedData) {
      if (err) {
        return next(err);
      }
      res.redirect(req.baseUrl + '/' + savedData.id);
    });
  }
);
// [END add]

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
router.post(
  '/:person/edit',
  images.multer.single('image'),
  images.sendUploadToGCS,
  function update (req, res, next) {
    var data = req.body;

    // Was an image uploaded? If so, we'll use its public URL
    // in cloud storage.
    if (req.file && req.file.cloudStoragePublicUrl) {
      req.body.imageUrl = req.file.cloudStoragePublicUrl;
    }

    getModel().update(req.params.person, data, true, function (err, savedData) {
      if (err) {
        return next(err);
      }
      res.redirect(req.baseUrl + '/' + savedData.id);
    });
  }
);

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
