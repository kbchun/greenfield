var Memory = require('../models/memoryModel');
var User = require('../models/userModel');
var awsClient = require('../../server/aws');
var fs = require('fs');
var clarifai = require('../../api/clarifai');
var microsoft = require('../../api/microsoft');

exports.upload = function(req, res) {
  if (!req.file) {
    console.log('Multer failed to save file');
    res.status(404).send();
  } else {
      awsClient.upload('uploads/' + req.file.filename, {}, function(err, versions, meta) {
        if (err) { 
          console.log('s3 upload error: ', err); 
        } 

        versions.forEach(function(image) {
          if (image.original) {
            Memory.create({
              title: req.file.filename,
              filePath: image.url, 
              createdAt: Date.now()
            }).then(function(memory) {
              fs.unlink('uploads/' + req.file.filename, function(err, success) {
                if (err) {
                  console.log('Error deleting file,', err);
                }
              });

              // Call Clarifai API and store results
              clarifai(image.url).then(function(tags) {
                var results = {
                  api: 'clarifai',
                  tags: tags
                };

                memory.analyses.push(results);
                memory.save();
              });

              // Call Microsoft API and store results
              microsoft(image.url).then(function(tags) {
                var results = {
                  api: 'microsoft',
                  tags: []
                };

                // Save original results
                results.original = tags;

                // Filter by tags of 0.5 score or higher
                tags.forEach(function(tag) {
                  if (tag.confidence > 0.5) {
                    results.tags.push(tag.name);
                  }
                });

                memory.analyses.push(results);
                memory.save();
              });

              User.findOne({username: req.user.username}).then(function(user) {
                user.memories.push(memory._id);   
                user.save(function(err) {
                  res.status(201).send(memory._id);
                });
              });
            }).catch(function(err) {
              console.log('Error creating memory,', err);
              res.status(404).send();
            });
          }
        });
      });
  }
};

exports.fetchMemories = function(req, res) {
  User.findOne({ username: req.user.username }).populate('memories').then(function(user) {
    res.status(200).send(user.memories);
  }).catch(function(err) {
    console.log('Error retrieving user,', err);
    res.status(404).send();
  });
};

exports.fetchOne = function(req, res) {
  Memory.findOne({ _id: req.params.id }).then(function(memory) {
    res.status(200).send(memory);
  }).catch(function(err) {
    res.status(404).send();
  });
};

var addOne = function(req, res) {

};