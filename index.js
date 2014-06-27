'usr strict';

var fs = require('fs');
var util = require('util');
var Transform = require('stream').Transform;
var toPromise = require('stream-to-promise');

module.exports = Stringify;

util.inherits(Stringify, Transform);

function Stringify(options) {
  options || (options = {});
  Transform.call(this, options);
  this.content = '';
}

Stringify.prototype._transform = function (chunk, encoding, done) {
  this.content += chunk.toString();
  done();
};

Stringify.prototype._flush = function (done) {
  var str = this.content
    .replace(/\"/g, '\u005C\u0022')
    .split('\n')
    .join('"\n  + "');

  str = '"' + str + '"';

  this.push(str);

  done();
};

Stringify.promise = function (file) {
  var stream = fs.createReadStream(file)
    .pipe(new Stringify());
  return toPromise(stream);
};
