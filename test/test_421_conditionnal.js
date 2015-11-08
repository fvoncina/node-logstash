var vows = require('vows-batch-retry'),
  assert = require('assert'),
  fs = require('fs'),
  logger = require('log4node'),
  logstash_config = require('logstash_config'),
  config_mapper = require('lib/config_mapper'),
  async = require('async'),
  agent = require('agent');

function make_test(config_file, input, output_callback) {
  var r = {};
  r[config_file] = {
    topic: function() {
      var config = fs.readFileSync('test/test_421_conditionnal/base').toString() + '\n' + fs.readFileSync('test/test_421_conditionnal/' + config_file).toString();
      var c = logstash_config.parse(config);
      var a = agent.create();
      var callback = this.callback;
      fs.writeFileSync('input.txt', '');
      a.on('error', function(err) {
        logger.error(err);
        assert.ifError(err);
      });
      a.start(config_mapper.map(c), function(err) {
        assert.ifError(err);
        setTimeout(function() {
          async.eachSeries(input, function(x, callback) {
            fs.appendFile('input.txt', x + '\n', function(err) {
              if (err) {
                return callback(err);
              }
              setTimeout(callback, 50);
            });
          }, function() {
            setTimeout(function() {
              a.close(callback);
            }, 200);
          });
        }, 200);
      });
    },
    check: function(err) {
      assert.ifError(err);
      fs.unlinkSync('input.txt');
      var output = fs.readFileSync('output.txt');
      fs.unlinkSync('output.txt');
      var lines = output.toString().split('\n');
      lines.pop();
      output_callback(lines.map(function(x) {
        return JSON.parse(x);
      }));
    }
  };
  return r;
}

vows.describe('Conditional integration tests').addBatch(
  make_test('simple', [
    'abcd',
    'defg',
  ], function(l) {
    assert.equal(2, l.length);
    assert.equal('abcd', l[0].message);
    assert.equal('defg', l[1].message);
  })
).addBatch(
  make_test('simple_if', [
    'abcd',
    'defg',
  ], function(l) {
    assert.equal(1, l.length);
    assert.equal('defg', l[0].message);
  })
).addBatch(
  make_test('if_regex', [
    'abcd',
    'defgab',
    'hjh',
  ], function(l) {
    assert.equal(l.length, 2);
    assert.equal('abcd', l[0].message);
    assert.equal('defgab', l[1].message);
  })
).addBatch(
  make_test('else_else_if', [
    'abcd',
    'defgab',
    'hjh',
  ], function(l) {
    assert.equal(l.length, 3);
    assert.equal('tata', l[0].toto);
    assert.equal('titi', l[1].toto);
    assert.equal('tutu', l[2].toto);
  })
).addBatch(
  make_test('upper', [
    '12',
    '42',
    'abcd',
  ], function(l) {
    assert.equal(l.length, 3);
    assert.equal(undefined, l[0].toto);
    assert.equal('tata', l[1].toto);
    assert.equal(undefined, l[2].toto);
  })
).export(module);
