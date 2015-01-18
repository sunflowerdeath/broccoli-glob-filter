#broccoli-glob-filter

Base class for broccoli plugins that processes files one by one.

Features:

* It stores results in the cache and rebuilds only changed files.
* It supports glob patterns to specify files to filter.

##Install

```
npm install broccoli-glob-filter
```

##Usage

```js
var Filter = require('broccoli-glob-filter')

var MyFilter = function(inputTree, options) {
  Filter.apply(this, arguments)
}
MyFilter.prototype = Object.create(Filter.prototype)
MyFilter.processFileContent = function(content, relPath, srcDir) {
  return 'content of filtered file'

  //You can return an array, when you need to create more than one file,
  //or to set special path of a file.
  return [
    {
      path: 'path/of/new/file',
      content: 'content'
    }
  ]
}
```

##API

###Filter(inputTree, [options])

Constructor.

####inputTree

Type: `Tree`

####options

Type: `object`

###List of options

####files

Type: `array<string>`
<br>
Default: `['**']`

Glob patterns for filtered files.

####targetExtension

Type: `string`

New extension of filtered files.

####changeFileName

Type: `function(string) -> string`

Function that is called for every file with its filename and should
return new filename of the filtered file.
<br>
When this function is specified, option `targetExtension` doesn't work.

###Filter.processFileContent(content, relPath, srcDir)

Returns: `string|array<object>`

This method must be implemented in the inherited class.
It processes content of each file from the `inputTree` that matches patterns
and returns content of the new file.

If you need to create more than one file, or to set special path of a file,
you can return an array of file objects with the following properties:
* `path` &ndash; relative path of the new file.
* `content` &ndash; content of the new file.

If you want to process a file asynchronously, you can return a promise.

####content

Type: `string`

Content of source file.

####relPath

Type: `string`

Relative path of source file.

####srcDir

Type: `string`

Path of the `inputTree`.
You can use it, when you need to read additional files from tree.

##License

Public domain, see the `LICENCE.md` file.

