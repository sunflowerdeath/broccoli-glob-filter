var assert = require('assert')
var path = require('path')
var fs = require('fs-extra')
var sinon = require('sinon')
var broccoli = require('broccoli')
var Q = require('q')

var Filter = require('..')

describe('Filter', function() {
	var ORIG_DIR = path.join(__dirname, 'files')
	var DIR = path.join(__dirname, 'files-copy')

	var ONE_FILE_DIR = path.join(__dirname, 'one-file')

	var builder

	var createCustomFilter = function() {
		var CustomFilter = function(inputTrees, options) {
			if (!(this instanceof CustomFilter)) return new CustomFilter(inputTrees, options)
			Filter.apply(this, arguments)
		}
		CustomFilter.prototype = Object.create(Filter.prototype)
		return CustomFilter
	}

	beforeEach(function() {
		fs.copySync(ORIG_DIR, DIR)
	})

	afterEach(function() {
		if (builder) builder.cleanup()
		fs.removeSync(DIR)
	})

	it('throws when "processFileContent" is not implemented', function(done) {
		var CustomFilter = createCustomFilter()
		var tree = new CustomFilter(DIR)
		builder = new broccoli.Builder(tree)
		builder.build()
			.then(function() { done(new Error('Have not thrown')) })
			.catch(function() { done() })
	})

	it('calls "processFileContent"', function() {
		var CustomFilter = createCustomFilter()
		var spy = CustomFilter.prototype.processFileContent = sinon.spy()
		var tree = new CustomFilter(ONE_FILE_DIR)
		builder = new broccoli.Builder(tree)
		return builder.build().then(function() {
			var args = spy.firstCall.args
			assert.equal(args[0], 'file.js\n')
			assert.equal(args[1], 'file.js')
			assert.equal(args[2], ONE_FILE_DIR)
		})
	})

	var FILTERED = 'filtered'

	it('filters files', function() {
		var CustomFilter = createCustomFilter()
		CustomFilter.prototype.processFileContent = function() { return FILTERED }
		var tree = new CustomFilter(ONE_FILE_DIR)
		builder = new broccoli.Builder(tree)
		return builder.build().then(function(result) {
			var dir = result.directory
			var content = fs.readFileSync(path.join(dir, 'file.js'), 'utf-8')
			assert.equal(content, FILTERED)
		})
	})

	it('uses "targetExtension"', function() {
		var CustomFilter = createCustomFilter()
		CustomFilter.prototype.processFileContent = function() { return  FILTERED }
		var tree = new CustomFilter(ONE_FILE_DIR, {targetExtension: 'ext'})
		builder = new broccoli.Builder(tree)
		return builder.build().then(function(result) {
			var dir = result.directory
			var content = fs.readFileSync(path.join(dir, 'file.ext'), 'utf-8')
			assert.equal(content, FILTERED)
		})
	})

	it('uses "changeFileName"', function() {
		var CustomFilter = createCustomFilter()
		CustomFilter.prototype.processFileContent = function() { return  FILTERED }
		var tree = new CustomFilter(ONE_FILE_DIR, {
			targetExtension: 'ext',
			changeFileName: function(name) { return name + '.changed' }
		})
		builder = new broccoli.Builder(tree)
		return builder.build().then(function(result) {
			var dir = result.directory
			var content = fs.readFileSync(path.join(dir, 'file.js.changed'), 'utf-8')
			assert.equal(content, FILTERED)
		})
	})

	it('can return many files', function() {
		var RESULT = [
			{path: 'file1.js', content: 'FILE1'},
			{path: 'file2.js', content: 'FILE2'}
		]
		var CustomFilter = createCustomFilter()
		CustomFilter.prototype.processFileContent = function() { return RESULT }
		var tree = new CustomFilter(ONE_FILE_DIR)
		builder = new broccoli.Builder(tree)
		return builder.build().then(function(result) {
			var dir = result.directory
			RESULT.forEach(function(file) {
				var content = fs.readFileSync(path.join(dir, file.path), 'utf-8')
				assert.equal(content, file.content)
			})
		})
	})

	it('can process files asynchronously', function() {
		var CustomFilter = createCustomFilter()
		CustomFilter.prototype.processFileContent = function() {
			var deferred = Q.defer()
			setTimeout(function() { deferred.resolve(FILTERED) })
			return deferred.promise
		}
		var tree = new CustomFilter(ONE_FILE_DIR)
		builder = new broccoli.Builder(tree)
		return builder.build().then(function(result) {
			var dir = result.directory
			var content = fs.readFileSync(path.join(dir, 'file.js'), 'utf-8')
			assert.equal(content, FILTERED)
		})
	})

	it('copy not changed files from cache', function() {
		var CustomFilter = createCustomFilter()
		var spy = CustomFilter.prototype.processFileContent = sinon.spy()
		var tree = new CustomFilter(DIR)
		builder = new broccoli.Builder(tree)
		return builder.build()
			.then(function() { assert.equal(spy.callCount, 3) })
			.then(function() {
				fs.writeFileSync(path.join(DIR, 'file.js'), 'CHANGED')
				return builder.build()
			})
			.then(function() { assert.equal(spy.callCount, 4) })
	})

	it('finds files using globs', function() {
		var CustomFilter = createCustomFilter()
		var spy = CustomFilter.prototype.processFileContent = sinon.spy()
		var tree = new CustomFilter(DIR, {files: ['**/*.js']})
		builder = new broccoli.Builder(tree)
		return builder.build()
			.then(function() { assert.equal(spy.callCount, 1) })
	})

})
