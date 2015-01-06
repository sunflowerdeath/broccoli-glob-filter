var fs = require('fs')
var path = require('path')

var _ = require('underscore')
var Q = require('q')
var quickTemp = require('quick-temp')
var dirmatch = require('dirmatch')
var mkdirp = require('mkdirp')
var copyDereferenceSync = require('copy-dereference').sync

var Filter = function(inputTree, options) {
	if (options.files === undefined) options.files = ['**']
	this.inputTree = inputTree
	this.options = options
	this.cache = {}
	quickTemp.makeOrRemake(this, 'cacheDir')
}

//Calls processFile for each file matching 'options.files'
Filter.prototype.read = function(readTree) {
	quickTemp.makeOrRemake(this, 'destDir')
	var _this = this
	readTree(this.inputTree, function(srcDir) {
		var files = dirmatch(srcDir, _this.options.files)
		var results = _.map(files, function(file) {
			return _this.processFile(file, srcDir)
		})
		return Q.all(results).then(function() { return _this.destDir })
	})
}

//Compares file's hash and cached hash, and if they are different,
//calls `processFilesContent` and writes result to `cacheDir`.
//Then it copies files from `cacheDir` to `destDir`.
Filter.prototype.processFile = function(relPath, srcDir) {
	var _this = this
	var cacheEntry = this.cache[relPath]
	var absPath = path.join(srcDir, relPath)
	var hash = this.hashFile(absPath)
	var promise
	if (cacheEntry && cacheEntry.hash === hash) {
		promise = Q(cacheEntry)
	} else {
		var content = fs.readFileSync(absPath)
		var process = this.processFileContent(content, relPath, srcDir)
		var promise = Q.when(process).then(function(result) {
			_this.saveToCache(result, relPath, hash)
		})
	}
	return promise.then(function(cacheEntry) {
		this.copyFromCache(cacheEntry)
	})
}

//Saves result of `processFileContent` to `cacheDir`.
//Result can be an array of file objects with paths and contents of new files,
//or a string with content of new file.
Filter.prototype.saveToCache = function(result, file, hash) {
	if (typeof result === 'string') {
		result = [{
			path: this.getDestFilePath(file),
			content: result
		}]
	}
	_.each(result, function(file) {
		var dest = path.join(this.cacheDir, file.path)
		mkdirp(path.dirname(dest))
		fs.writeFileSync(dest, result)
	}, this)
	var cacheEntry = {
		hash: hash,
		outputFiles: _.keys(result)
	}
	this.cache[file] = cacheEntry
	return cacheEntry
}

//Path of file is original path with extension from `options.targetExtension`
Filter.prototype.getDestFilePath = function(file) {
	//TODO
	return file
}

Filter.prototype.hashFile = function(file) {
	var stats = fs.statSync(file)
	return String(stats.mtime.getTime()) + String(stats.size)
}

//Copies files from cacheDir to destDir.
Filter.prototype.copyFromCache = function(cacheEntry) {
	_.each(cacheEntry.outputFiles, function(file) {
		var src = path.join(this.cacheDir, file.path)
		var dest = path.join(this.destDir, file.path)
		mkdirp(path.dirname(dest))
		copyDereferenceSync(src, dest)
	}, this)
}

Filter.prototype.processFileContent = function(/* content, file, srcDir */) {
	return new Error('You must implement method "processFileContent"')
}

Filter.prototype.cleanup = function() {
	quickTemp.remove(this, 'cacheDir')
	quickTemp.remove(this, 'destDir')
}

module.exports = Filter
