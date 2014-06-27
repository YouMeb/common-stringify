#!/usr/bin/env node

'use strict';

var fs = require('fs');
var path = require('path');
var load = require('polyfill-loader');
var Promise = load('Promise', 'bluebird');
var promisify = require('es6-promisify');
var mkdirp = promisify(require('mkdirp'));
var debug = require('debug')('common-stringify');
var stringify = require('../');
var readFile = promisify(fs.readFile);
var writeFile = promisify(fs.writeFile);
var args = process.argv.slice(2);
var entrypoint;

var outputDir = path.join(process.cwd(), 'out');
var exts = {};

args.forEach(function (arg) {
  if (/^-+/.test(arg)) {
    if (/^--ext=/.test(arg)) {
      exts[arg.replace(/^--ext=/, '')] = 1;
    } else if (/^--out=/.test(arg)) {
      outputDir = path.resolve(process.cwd(), arg.replace(/^--out=/, ''));
    }
  } else if (!entrypoint) {
    entrypoint = arg;
  }
});

createOutputDir()
  .then(function () {
    run(entrypoint)
      .catch(function (e) {
        console.log(e.stack);
      });
  });

function createOutputDir() {
  return mkdirp(outputDir);
}

function run(file) {
  file = path.resolve(process.cwd(), file);

  debug('run %s', file);

  return getFiles(file)
    .then(moduleStringify)
    .then(insertString)
    .then(createFile);
}

function getFiles(file) {
  debug('getFiles %s', file);

  return readFile(file, 'utf8')
    .then(function (content) {
      var filepaths = [];
      var dirname = path.dirname(file);

      content = content
        .replace(/require\((['"])(.*?)\1\)/g, function (_, quote, filepath) {
          filepath = path.resolve(dirname, filepath);
          filepaths.push(filepath);

          if (exts[path.extname(filepath)]) {
            debug('find %s', filepath);
            return '{(< ' + filepath + ' >)}';
          } else {
            return _;
          }
        });

      return {
        content: content,
        filepath: file,
        filepaths: filepaths,
        childContents: {}
      };
    });
}

function moduleStringify(data) {
  debug('moduleStringify %s', data.filepath);

  var filepaths = data.filepaths;
  var promisies = [];
  
  filepaths.forEach(function (filepath) {
    var extname = path.extname(filepath);
    var promise;

    if (!/^\.?\//.test(filepath) && (!extname || extname === '.js')) {
      promise = run(filepath);
    } else if (exts[extname]) {
      promise = stringify.promise(filepath)
        .then(function (str) {
          data.childContents[filepath] = str;
        });
    }

    promise && promisies.push(promise);
  });

  return Promise.all(promisies)
    .then(function () {
      return data;
    });
}

function insertString(data) {
  debug('insertString %s', data.filepath);

  Object.keys(data.childContents).forEach(function (filepath) {
    var content = data.childContents[filepath];
    data.content = data.content.replace('{(< ' + filepath + ' >)}', content);
  });

  return data;
}

function createFile(data) {
  var dirname = path.dirname(data.filepath);
  var basename = path.basename(data.filepath);

  var relative = path.relative(
    dirname,
    outputDir
  );

  var filepath = path.resolve(dirname, relative, basename);

  debug('createFile %s', filepath);

  return writeFile(filepath, data.content);
}
