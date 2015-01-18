var fs = require('fs')
var path = require('path')

var _ = require('underscore')
var Q = require('q')
var quickTemp = require('quick-temp')
var dirmatch = require('dirmatch')
var mkdirp = require('mkdirp')
var symlinkOrCopySync = require('symlink-or-copy').sync

var Filter = function(inputTree, options) {
	if (!options) options = {}
	if (!options.files) options.files = ['**']
	if (!options.encoding) options.encoding = 'utf-8'
	this.inputTree = inputTree
	this.options = options
	this.cache = {}
	quickTemp.makeOrRemake(this, 'cacheDir')
}

/** Calls processFile for each file matching 'options.files'. */
Filter.prototype.read = function(readTree) {
	quickTemp.makeOrRemake(this, 'destDir')
	var _this = this
	return readTree(this.inputTree).then(function(srcDir) {
		var files = dirmatch(srcDir, _this.options.files)
		var results = _.map(files, function(file) {
			return _this.processFile(file, srcDir)
		})
		return Q.all(results).then(function() { return _this.destDir })
	})
}

/**
 * Compares file's hash and cached hash, and if they are different,
 * calls 'processFilesContent' and writes result to 'cacheDir'.
 * Then it copies result from 'cacheDir' to 'destDir'.
 */
Filter.prototype.processFile = function(relPath, srcDir) {
	var _this = this
	var cacheEntry = this.cache[relPath]
	var absPath = path.join(srcDir, relPath)
	var hash = this.hashFile(absPath)
	var promise
	if (cacheEntry && cacheEntry.hash === hash) {
		promise = Q(cacheEntry)
	} else {
		var content = fs.readFileSync(absPath, this.options.encoding)
		var process = this.processFileContent(content, relPath, srcDir)
		var promise = Q.when(process).then(function(result) {
			return _this.saveToCache(result, relPath, hash)
		})
	}
	return promise.then(this.copyFromCache.bind(this))
}

/**
 * Saves result of 'processFileContent' to the 'cacheDir'.
 * Result can be an array of file objects with paths and contents of new files,
 * or a string with content of new file.
 */
Filter.prototype.saveToCache = function(result, file, hash) {
	if (typeof result === 'string') {
		result = [{
			path: this.getDestFilePath(file),
			content: result
		}]
	}
	_.each(result, function(file) {
		var dest = path.join(this.cacheDir, file.path)
		mkdirp.sync(path.dirname(dest))
		fs.writeFileSync(dest, file.content, this.options.encoding)
	}, this)
	var cacheEntry = {
		hash: hash,
		outputFiles: _.pluck(result, 'path')
	}
	this.cache[file] = cacheEntry
	return cacheEntry
}

/**
 * Makes path of filtered file.
 * New path is original path with extension from 'options.targetExtension'.
 */
Filter.prototype.getDestFilePath = function(file) {
	var name = path.basename(file)
	if (this.options.changeFileName) {
		name = this.options.changeFileName(name)
	} else if (this.options.targetExtension) {
		name = path.basename(name, path.extname(name)) + '.' +
			this.options.targetExtension
	}
	return path.join(path.dirname(file), name)
}

Filter.prototype.hashFile = function(file) {
	var stats = fs.statSync(file)
	return String(stats.mtime.getTime()) + String(stats.size)
}

/** Copies files from 'cacheDir' to 'destDir'. */
Filter.prototype.copyFromCache = function(cacheEntry) {
	_.each(cacheEntry.outputFiles, function(file) {
		var src = path.join(this.cacheDir, file)
		var dest = path.join(this.destDir, file)
		mkdirp.sync(path.dirname(dest))
		symlinkOrCopySync(src, dest)
	}, this)
}

Filter.prototype.processFileContent = function(/* content, file, srcDir */) {
	throw new Error('You must implement method "processFileContent"')
}

Filter.prototype.cleanup = function() {
	quickTemp.remove(this, 'cacheDir')
	quickTemp.remove(this, 'destDir')
}

module.exports = Filter
