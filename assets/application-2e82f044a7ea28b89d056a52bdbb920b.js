/**
 * lunr - http://lunrjs.com - A bit like Solr, but much smaller and not as bright - 0.5.11
 * Copyright (C) 2015 Oliver Nightingale
 * MIT Licensed
 * @license
 */


;(function(){

/**
 * Convenience function for instantiating a new lunr index and configuring it
 * with the default pipeline functions and the passed config function.
 *
 * When using this convenience function a new index will be created with the
 * following functions already in the pipeline:
 *
 * lunr.StopWordFilter - filters out any stop words before they enter the
 * index
 *
 * lunr.stemmer - stems the tokens before entering the index.
 *
 * Example:
 *
 *     var idx = lunr(function () {
 *       this.field('title', 10)
 *       this.field('tags', 100)
 *       this.field('body')
 *       
 *       this.ref('cid')
 *       
 *       this.pipeline.add(function () {
 *         // some custom pipeline function
 *       })
 *       
 *     })
 *
 * @param {Function} config A function that will be called with the new instance
 * of the lunr.Index as both its context and first parameter. It can be used to
 * customize the instance of new lunr.Index.
 * @namespace
 * @module
 * @returns {lunr.Index}
 *
 */
var lunr = function (config) {
  var idx = new lunr.Index

  idx.pipeline.add(
    lunr.trimmer,
    lunr.stopWordFilter,
    lunr.stemmer
  )

  if (config) config.call(idx, idx)

  return idx
}

lunr.version = "0.5.11"
/*!
 * lunr.utils
 * Copyright (C) 2015 Oliver Nightingale
 */

/**
 * A namespace containing utils for the rest of the lunr library
 */
lunr.utils = {}

/**
 * Print a warning message to the console.
 *
 * @param {String} message The message to be printed.
 * @memberOf Utils
 */
lunr.utils.warn = (function (global) {
  return function (message) {
    if (global.console && console.warn) {
      console.warn(message)
    }
  }
})(this)

/*!
 * lunr.EventEmitter
 * Copyright (C) 2015 Oliver Nightingale
 */

/**
 * lunr.EventEmitter is an event emitter for lunr. It manages adding and removing event handlers and triggering events and their handlers.
 *
 * @constructor
 */
lunr.EventEmitter = function () {
  this.events = {}
}

/**
 * Binds a handler function to a specific event(s).
 *
 * Can bind a single function to many different events in one call.
 *
 * @param {String} [eventName] The name(s) of events to bind this function to.
 * @param {Function} fn The function to call when an event is fired.
 * @memberOf EventEmitter
 */
lunr.EventEmitter.prototype.addListener = function () {
  var args = Array.prototype.slice.call(arguments),
      fn = args.pop(),
      names = args

  if (typeof fn !== "function") throw new TypeError ("last argument must be a function")

  names.forEach(function (name) {
    if (!this.hasHandler(name)) this.events[name] = []
    this.events[name].push(fn)
  }, this)
}

/**
 * Removes a handler function from a specific event.
 *
 * @param {String} eventName The name of the event to remove this function from.
 * @param {Function} fn The function to remove from an event.
 * @memberOf EventEmitter
 */
lunr.EventEmitter.prototype.removeListener = function (name, fn) {
  if (!this.hasHandler(name)) return

  var fnIndex = this.events[name].indexOf(fn)
  this.events[name].splice(fnIndex, 1)

  if (!this.events[name].length) delete this.events[name]
}

/**
 * Calls all functions bound to the given event.
 *
 * Additional data can be passed to the event handler as arguments to `emit`
 * after the event name.
 *
 * @param {String} eventName The name of the event to emit.
 * @memberOf EventEmitter
 */
lunr.EventEmitter.prototype.emit = function (name) {
  if (!this.hasHandler(name)) return

  var args = Array.prototype.slice.call(arguments, 1)

  this.events[name].forEach(function (fn) {
    fn.apply(undefined, args)
  })
}

/**
 * Checks whether a handler has ever been stored against an event.
 *
 * @param {String} eventName The name of the event to check.
 * @private
 * @memberOf EventEmitter
 */
lunr.EventEmitter.prototype.hasHandler = function (name) {
  return name in this.events
}

/*!
 * lunr.tokenizer
 * Copyright (C) 2015 Oliver Nightingale
 */

/**
 * A function for splitting a string into tokens ready to be inserted into
 * the search index.
 *
 * @module
 * @param {String} obj The string to convert into tokens
 * @returns {Array}
 */
lunr.tokenizer = function (obj) {
  if (!arguments.length || obj == null || obj == undefined) return []
  if (Array.isArray(obj)) return obj.map(function (t) { return t.toLowerCase() })

  return obj.toString().trim().toLowerCase().split(/[\s\-]+/)
}

/*!
 * lunr.Pipeline
 * Copyright (C) 2015 Oliver Nightingale
 */

/**
 * lunr.Pipelines maintain an ordered list of functions to be applied to all
 * tokens in documents entering the search index and queries being ran against
 * the index.
 *
 * An instance of lunr.Index created with the lunr shortcut will contain a
 * pipeline with a stop word filter and an English language stemmer. Extra
 * functions can be added before or after either of these functions or these
 * default functions can be removed.
 *
 * When run the pipeline will call each function in turn, passing a token, the
 * index of that token in the original list of all tokens and finally a list of
 * all the original tokens.
 *
 * The output of functions in the pipeline will be passed to the next function
 * in the pipeline. To exclude a token from entering the index the function
 * should return undefined, the rest of the pipeline will not be called with
 * this token.
 *
 * For serialisation of pipelines to work, all functions used in an instance of
 * a pipeline should be registered with lunr.Pipeline. Registered functions can
 * then be loaded. If trying to load a serialised pipeline that uses functions
 * that are not registered an error will be thrown.
 *
 * If not planning on serialising the pipeline then registering pipeline functions
 * is not necessary.
 *
 * @constructor
 */
lunr.Pipeline = function () {
  this._stack = []
}

lunr.Pipeline.registeredFunctions = {}

/**
 * Register a function with the pipeline.
 *
 * Functions that are used in the pipeline should be registered if the pipeline
 * needs to be serialised, or a serialised pipeline needs to be loaded.
 *
 * Registering a function does not add it to a pipeline, functions must still be
 * added to instances of the pipeline for them to be used when running a pipeline.
 *
 * @param {Function} fn The function to check for.
 * @param {String} label The label to register this function with
 * @memberOf Pipeline
 */
lunr.Pipeline.registerFunction = function (fn, label) {
  if (label in this.registeredFunctions) {
    lunr.utils.warn('Overwriting existing registered function: ' + label)
  }

  fn.label = label
  lunr.Pipeline.registeredFunctions[fn.label] = fn
}

/**
 * Warns if the function is not registered as a Pipeline function.
 *
 * @param {Function} fn The function to check for.
 * @private
 * @memberOf Pipeline
 */
lunr.Pipeline.warnIfFunctionNotRegistered = function (fn) {
  var isRegistered = fn.label && (fn.label in this.registeredFunctions)

  if (!isRegistered) {
    lunr.utils.warn('Function is not registered with pipeline. This may cause problems when serialising the index.\n', fn)
  }
}

/**
 * Loads a previously serialised pipeline.
 *
 * All functions to be loaded must already be registered with lunr.Pipeline.
 * If any function from the serialised data has not been registered then an
 * error will be thrown.
 *
 * @param {Object} serialised The serialised pipeline to load.
 * @returns {lunr.Pipeline}
 * @memberOf Pipeline
 */
lunr.Pipeline.load = function (serialised) {
  var pipeline = new lunr.Pipeline

  serialised.forEach(function (fnName) {
    var fn = lunr.Pipeline.registeredFunctions[fnName]

    if (fn) {
      pipeline.add(fn)
    } else {
      throw new Error('Cannot load un-registered function: ' + fnName)
    }
  })

  return pipeline
}

/**
 * Adds new functions to the end of the pipeline.
 *
 * Logs a warning if the function has not been registered.
 *
 * @param {Function} functions Any number of functions to add to the pipeline.
 * @memberOf Pipeline
 */
lunr.Pipeline.prototype.add = function () {
  var fns = Array.prototype.slice.call(arguments)

  fns.forEach(function (fn) {
    lunr.Pipeline.warnIfFunctionNotRegistered(fn)
    this._stack.push(fn)
  }, this)
}

/**
 * Adds a single function after a function that already exists in the
 * pipeline.
 *
 * Logs a warning if the function has not been registered.
 *
 * @param {Function} existingFn A function that already exists in the pipeline.
 * @param {Function} newFn The new function to add to the pipeline.
 * @memberOf Pipeline
 */
lunr.Pipeline.prototype.after = function (existingFn, newFn) {
  lunr.Pipeline.warnIfFunctionNotRegistered(newFn)

  var pos = this._stack.indexOf(existingFn)
  if (pos == -1) {
    throw new Error('Cannot find existingFn')
  }

  pos = pos + 1
  this._stack.splice(pos, 0, newFn)
}

/**
 * Adds a single function before a function that already exists in the
 * pipeline.
 *
 * Logs a warning if the function has not been registered.
 *
 * @param {Function} existingFn A function that already exists in the pipeline.
 * @param {Function} newFn The new function to add to the pipeline.
 * @memberOf Pipeline
 */
lunr.Pipeline.prototype.before = function (existingFn, newFn) {
  lunr.Pipeline.warnIfFunctionNotRegistered(newFn)

  var pos = this._stack.indexOf(existingFn)
  if (pos == -1) {
    throw new Error('Cannot find existingFn')
  }

  this._stack.splice(pos, 0, newFn)
}

/**
 * Removes a function from the pipeline.
 *
 * @param {Function} fn The function to remove from the pipeline.
 * @memberOf Pipeline
 */
lunr.Pipeline.prototype.remove = function (fn) {
  var pos = this._stack.indexOf(fn)
  if (pos == -1) {
    return
  }

  this._stack.splice(pos, 1)
}

/**
 * Runs the current list of functions that make up the pipeline against the
 * passed tokens.
 *
 * @param {Array} tokens The tokens to run through the pipeline.
 * @returns {Array}
 * @memberOf Pipeline
 */
lunr.Pipeline.prototype.run = function (tokens) {
  var out = [],
      tokenLength = tokens.length,
      stackLength = this._stack.length

  for (var i = 0; i < tokenLength; i++) {
    var token = tokens[i]

    for (var j = 0; j < stackLength; j++) {
      token = this._stack[j](token, i, tokens)
      if (token === void 0) break
    };

    if (token !== void 0) out.push(token)
  };

  return out
}

/**
 * Resets the pipeline by removing any existing processors.
 *
 * @memberOf Pipeline
 */
lunr.Pipeline.prototype.reset = function () {
  this._stack = []
}

/**
 * Returns a representation of the pipeline ready for serialisation.
 *
 * Logs a warning if the function has not been registered.
 *
 * @returns {Array}
 * @memberOf Pipeline
 */
lunr.Pipeline.prototype.toJSON = function () {
  return this._stack.map(function (fn) {
    lunr.Pipeline.warnIfFunctionNotRegistered(fn)

    return fn.label
  })
}
/*!
 * lunr.Vector
 * Copyright (C) 2015 Oliver Nightingale
 */

/**
 * lunr.Vectors implement vector related operations for
 * a series of elements.
 *
 * @constructor
 */
lunr.Vector = function () {
  this._magnitude = null
  this.list = undefined
  this.length = 0
}

/**
 * lunr.Vector.Node is a simple struct for each node
 * in a lunr.Vector.
 *
 * @private
 * @param {Number} The index of the node in the vector.
 * @param {Object} The data at this node in the vector.
 * @param {lunr.Vector.Node} The node directly after this node in the vector.
 * @constructor
 * @memberOf Vector
 */
lunr.Vector.Node = function (idx, val, next) {
  this.idx = idx
  this.val = val
  this.next = next
}

/**
 * Inserts a new value at a position in a vector.
 *
 * @param {Number} The index at which to insert a value.
 * @param {Object} The object to insert in the vector.
 * @memberOf Vector.
 */
lunr.Vector.prototype.insert = function (idx, val) {
  this._magnitude = undefined;
  var list = this.list

  if (!list) {
    this.list = new lunr.Vector.Node (idx, val, list)
    return this.length++
  }

  if (idx < list.idx) {
    this.list = new lunr.Vector.Node (idx, val, list)
    return this.length++
  }

  var prev = list,
      next = list.next

  while (next != undefined) {
    if (idx < next.idx) {
      prev.next = new lunr.Vector.Node (idx, val, next)
      return this.length++
    }

    prev = next, next = next.next
  }

  prev.next = new lunr.Vector.Node (idx, val, next)
  return this.length++
}

/**
 * Calculates the magnitude of this vector.
 *
 * @returns {Number}
 * @memberOf Vector
 */
lunr.Vector.prototype.magnitude = function () {
  if (this._magnitude) return this._magnitude
  var node = this.list,
      sumOfSquares = 0,
      val

  while (node) {
    val = node.val
    sumOfSquares += val * val
    node = node.next
  }

  return this._magnitude = Math.sqrt(sumOfSquares)
}

/**
 * Calculates the dot product of this vector and another vector.
 *
 * @param {lunr.Vector} otherVector The vector to compute the dot product with.
 * @returns {Number}
 * @memberOf Vector
 */
lunr.Vector.prototype.dot = function (otherVector) {
  var node = this.list,
      otherNode = otherVector.list,
      dotProduct = 0

  while (node && otherNode) {
    if (node.idx < otherNode.idx) {
      node = node.next
    } else if (node.idx > otherNode.idx) {
      otherNode = otherNode.next
    } else {
      dotProduct += node.val * otherNode.val
      node = node.next
      otherNode = otherNode.next
    }
  }

  return dotProduct
}

/**
 * Calculates the cosine similarity between this vector and another
 * vector.
 *
 * @param {lunr.Vector} otherVector The other vector to calculate the
 * similarity with.
 * @returns {Number}
 * @memberOf Vector
 */
lunr.Vector.prototype.similarity = function (otherVector) {
  return this.dot(otherVector) / (this.magnitude() * otherVector.magnitude())
}
/*!
 * lunr.SortedSet
 * Copyright (C) 2015 Oliver Nightingale
 */

/**
 * lunr.SortedSets are used to maintain an array of uniq values in a sorted
 * order.
 *
 * @constructor
 */
lunr.SortedSet = function () {
  this.length = 0
  this.elements = []
}

/**
 * Loads a previously serialised sorted set.
 *
 * @param {Array} serialisedData The serialised set to load.
 * @returns {lunr.SortedSet}
 * @memberOf SortedSet
 */
lunr.SortedSet.load = function (serialisedData) {
  var set = new this

  set.elements = serialisedData
  set.length = serialisedData.length

  return set
}

/**
 * Inserts new items into the set in the correct position to maintain the
 * order.
 *
 * @param {Object} The objects to add to this set.
 * @memberOf SortedSet
 */
lunr.SortedSet.prototype.add = function () {
  var i, element

  for (i = 0; i < arguments.length; i++) {
    element = arguments[i]
    if (~this.indexOf(element)) continue
    this.elements.splice(this.locationFor(element), 0, element)
  }

  this.length = this.elements.length
}

/**
 * Converts this sorted set into an array.
 *
 * @returns {Array}
 * @memberOf SortedSet
 */
lunr.SortedSet.prototype.toArray = function () {
  return this.elements.slice()
}

/**
 * Creates a new array with the results of calling a provided function on every
 * element in this sorted set.
 *
 * Delegates to Array.prototype.map and has the same signature.
 *
 * @param {Function} fn The function that is called on each element of the
 * set.
 * @param {Object} ctx An optional object that can be used as the context
 * for the function fn.
 * @returns {Array}
 * @memberOf SortedSet
 */
lunr.SortedSet.prototype.map = function (fn, ctx) {
  return this.elements.map(fn, ctx)
}

/**
 * Executes a provided function once per sorted set element.
 *
 * Delegates to Array.prototype.forEach and has the same signature.
 *
 * @param {Function} fn The function that is called on each element of the
 * set.
 * @param {Object} ctx An optional object that can be used as the context
 * @memberOf SortedSet
 * for the function fn.
 */
lunr.SortedSet.prototype.forEach = function (fn, ctx) {
  return this.elements.forEach(fn, ctx)
}

/**
 * Returns the index at which a given element can be found in the
 * sorted set, or -1 if it is not present.
 *
 * @param {Object} elem The object to locate in the sorted set.
 * @returns {Number}
 * @memberOf SortedSet
 */
lunr.SortedSet.prototype.indexOf = function (elem) {
  var start = 0,
      end = this.elements.length,
      sectionLength = end - start,
      pivot = start + Math.floor(sectionLength / 2),
      pivotElem = this.elements[pivot]

  while (sectionLength > 1) {
    if (pivotElem === elem) return pivot

    if (pivotElem < elem) start = pivot
    if (pivotElem > elem) end = pivot

    sectionLength = end - start
    pivot = start + Math.floor(sectionLength / 2)
    pivotElem = this.elements[pivot]
  }

  if (pivotElem === elem) return pivot

  return -1
}

/**
 * Returns the position within the sorted set that an element should be
 * inserted at to maintain the current order of the set.
 *
 * This function assumes that the element to search for does not already exist
 * in the sorted set.
 *
 * @param {Object} elem The elem to find the position for in the set
 * @returns {Number}
 * @memberOf SortedSet
 */
lunr.SortedSet.prototype.locationFor = function (elem) {
  var start = 0,
      end = this.elements.length,
      sectionLength = end - start,
      pivot = start + Math.floor(sectionLength / 2),
      pivotElem = this.elements[pivot]

  while (sectionLength > 1) {
    if (pivotElem < elem) start = pivot
    if (pivotElem > elem) end = pivot

    sectionLength = end - start
    pivot = start + Math.floor(sectionLength / 2)
    pivotElem = this.elements[pivot]
  }

  if (pivotElem > elem) return pivot
  if (pivotElem < elem) return pivot + 1
}

/**
 * Creates a new lunr.SortedSet that contains the elements in the intersection
 * of this set and the passed set.
 *
 * @param {lunr.SortedSet} otherSet The set to intersect with this set.
 * @returns {lunr.SortedSet}
 * @memberOf SortedSet
 */
lunr.SortedSet.prototype.intersect = function (otherSet) {
  var intersectSet = new lunr.SortedSet,
      i = 0, j = 0,
      a_len = this.length, b_len = otherSet.length,
      a = this.elements, b = otherSet.elements

  while (true) {
    if (i > a_len - 1 || j > b_len - 1) break

    if (a[i] === b[j]) {
      intersectSet.add(a[i])
      i++, j++
      continue
    }

    if (a[i] < b[j]) {
      i++
      continue
    }

    if (a[i] > b[j]) {
      j++
      continue
    }
  };

  return intersectSet
}

/**
 * Makes a copy of this set
 *
 * @returns {lunr.SortedSet}
 * @memberOf SortedSet
 */
lunr.SortedSet.prototype.clone = function () {
  var clone = new lunr.SortedSet

  clone.elements = this.toArray()
  clone.length = clone.elements.length

  return clone
}

/**
 * Creates a new lunr.SortedSet that contains the elements in the union
 * of this set and the passed set.
 *
 * @param {lunr.SortedSet} otherSet The set to union with this set.
 * @returns {lunr.SortedSet}
 * @memberOf SortedSet
 */
lunr.SortedSet.prototype.union = function (otherSet) {
  var longSet, shortSet, unionSet

  if (this.length >= otherSet.length) {
    longSet = this, shortSet = otherSet
  } else {
    longSet = otherSet, shortSet = this
  }

  unionSet = longSet.clone()

  unionSet.add.apply(unionSet, shortSet.toArray())

  return unionSet
}

/**
 * Returns a representation of the sorted set ready for serialisation.
 *
 * @returns {Array}
 * @memberOf SortedSet
 */
lunr.SortedSet.prototype.toJSON = function () {
  return this.toArray()
}
/*!
 * lunr.Index
 * Copyright (C) 2015 Oliver Nightingale
 */

/**
 * lunr.Index is object that manages a search index.  It contains the indexes
 * and stores all the tokens and document lookups.  It also provides the main
 * user facing API for the library.
 *
 * @constructor
 */
lunr.Index = function () {
  this._fields = []
  this._ref = 'id'
  this.pipeline = new lunr.Pipeline
  this.documentStore = new lunr.Store
  this.tokenStore = new lunr.TokenStore
  this.corpusTokens = new lunr.SortedSet
  this.eventEmitter =  new lunr.EventEmitter

  this._idfCache = {}

  this.on('add', 'remove', 'update', (function () {
    this._idfCache = {}
  }).bind(this))
}

/**
 * Bind a handler to events being emitted by the index.
 *
 * The handler can be bound to many events at the same time.
 *
 * @param {String} [eventName] The name(s) of events to bind the function to.
 * @param {Function} fn The serialised set to load.
 * @memberOf Index
 */
lunr.Index.prototype.on = function () {
  var args = Array.prototype.slice.call(arguments)
  return this.eventEmitter.addListener.apply(this.eventEmitter, args)
}

/**
 * Removes a handler from an event being emitted by the index.
 *
 * @param {String} eventName The name of events to remove the function from.
 * @param {Function} fn The serialised set to load.
 * @memberOf Index
 */
lunr.Index.prototype.off = function (name, fn) {
  return this.eventEmitter.removeListener(name, fn)
}

/**
 * Loads a previously serialised index.
 *
 * Issues a warning if the index being imported was serialised
 * by a different version of lunr.
 *
 * @param {Object} serialisedData The serialised set to load.
 * @returns {lunr.Index}
 * @memberOf Index
 */
lunr.Index.load = function (serialisedData) {
  if (serialisedData.version !== lunr.version) {
    lunr.utils.warn('version mismatch: current ' + lunr.version + ' importing ' + serialisedData.version)
  }

  var idx = new this

  idx._fields = serialisedData.fields
  idx._ref = serialisedData.ref

  idx.documentStore = lunr.Store.load(serialisedData.documentStore)
  idx.tokenStore = lunr.TokenStore.load(serialisedData.tokenStore)
  idx.corpusTokens = lunr.SortedSet.load(serialisedData.corpusTokens)
  idx.pipeline = lunr.Pipeline.load(serialisedData.pipeline)

  return idx
}

/**
 * Adds a field to the list of fields that will be searchable within documents
 * in the index.
 *
 * An optional boost param can be passed to affect how much tokens in this field
 * rank in search results, by default the boost value is 1.
 *
 * Fields should be added before any documents are added to the index, fields
 * that are added after documents are added to the index will only apply to new
 * documents added to the index.
 *
 * @param {String} fieldName The name of the field within the document that
 * should be indexed
 * @param {Number} boost An optional boost that can be applied to terms in this
 * field.
 * @returns {lunr.Index}
 * @memberOf Index
 */
lunr.Index.prototype.field = function (fieldName, opts) {
  var opts = opts || {},
      field = { name: fieldName, boost: opts.boost || 1 }

  this._fields.push(field)
  return this
}

/**
 * Sets the property used to uniquely identify documents added to the index,
 * by default this property is 'id'.
 *
 * This should only be changed before adding documents to the index, changing
 * the ref property without resetting the index can lead to unexpected results.
 *
 * @param {String} refName The property to use to uniquely identify the
 * documents in the index.
 * @param {Boolean} emitEvent Whether to emit add events, defaults to true
 * @returns {lunr.Index}
 * @memberOf Index
 */
lunr.Index.prototype.ref = function (refName) {
  this._ref = refName
  return this
}

/**
 * Add a document to the index.
 *
 * This is the way new documents enter the index, this function will run the
 * fields from the document through the index's pipeline and then add it to
 * the index, it will then show up in search results.
 *
 * An 'add' event is emitted with the document that has been added and the index
 * the document has been added to. This event can be silenced by passing false
 * as the second argument to add.
 *
 * @param {Object} doc The document to add to the index.
 * @param {Boolean} emitEvent Whether or not to emit events, default true.
 * @memberOf Index
 */
lunr.Index.prototype.add = function (doc, emitEvent) {
  var docTokens = {},
      allDocumentTokens = new lunr.SortedSet,
      docRef = doc[this._ref],
      emitEvent = emitEvent === undefined ? true : emitEvent

  this._fields.forEach(function (field) {
    var fieldTokens = this.pipeline.run(lunr.tokenizer(doc[field.name]))

    docTokens[field.name] = fieldTokens
    lunr.SortedSet.prototype.add.apply(allDocumentTokens, fieldTokens)
  }, this)

  this.documentStore.set(docRef, allDocumentTokens)
  lunr.SortedSet.prototype.add.apply(this.corpusTokens, allDocumentTokens.toArray())

  for (var i = 0; i < allDocumentTokens.length; i++) {
    var token = allDocumentTokens.elements[i]
    var tf = this._fields.reduce(function (memo, field) {
      var fieldLength = docTokens[field.name].length

      if (!fieldLength) return memo

      var tokenCount = docTokens[field.name].filter(function (t) { return t === token }).length

      return memo + (tokenCount / fieldLength * field.boost)
    }, 0)

    this.tokenStore.add(token, { ref: docRef, tf: tf })
  };

  if (emitEvent) this.eventEmitter.emit('add', doc, this)
}

/**
 * Removes a document from the index.
 *
 * To make sure documents no longer show up in search results they can be
 * removed from the index using this method.
 *
 * The document passed only needs to have the same ref property value as the
 * document that was added to the index, they could be completely different
 * objects.
 *
 * A 'remove' event is emitted with the document that has been removed and the index
 * the document has been removed from. This event can be silenced by passing false
 * as the second argument to remove.
 *
 * @param {Object} doc The document to remove from the index.
 * @param {Boolean} emitEvent Whether to emit remove events, defaults to true
 * @memberOf Index
 */
lunr.Index.prototype.remove = function (doc, emitEvent) {
  var docRef = doc[this._ref],
      emitEvent = emitEvent === undefined ? true : emitEvent

  if (!this.documentStore.has(docRef)) return

  var docTokens = this.documentStore.get(docRef)

  this.documentStore.remove(docRef)

  docTokens.forEach(function (token) {
    this.tokenStore.remove(token, docRef)
  }, this)

  if (emitEvent) this.eventEmitter.emit('remove', doc, this)
}

/**
 * Updates a document in the index.
 *
 * When a document contained within the index gets updated, fields changed,
 * added or removed, to make sure it correctly matched against search queries,
 * it should be updated in the index.
 *
 * This method is just a wrapper around `remove` and `add`
 *
 * An 'update' event is emitted with the document that has been updated and the index.
 * This event can be silenced by passing false as the second argument to update. Only
 * an update event will be fired, the 'add' and 'remove' events of the underlying calls
 * are silenced.
 *
 * @param {Object} doc The document to update in the index.
 * @param {Boolean} emitEvent Whether to emit update events, defaults to true
 * @see Index.prototype.remove
 * @see Index.prototype.add
 * @memberOf Index
 */
lunr.Index.prototype.update = function (doc, emitEvent) {
  var emitEvent = emitEvent === undefined ? true : emitEvent

  this.remove(doc, false)
  this.add(doc, false)

  if (emitEvent) this.eventEmitter.emit('update', doc, this)
}

/**
 * Calculates the inverse document frequency for a token within the index.
 *
 * @param {String} token The token to calculate the idf of.
 * @see Index.prototype.idf
 * @private
 * @memberOf Index
 */
lunr.Index.prototype.idf = function (term) {
  var cacheKey = "@" + term
  if (Object.prototype.hasOwnProperty.call(this._idfCache, cacheKey)) return this._idfCache[cacheKey]

  var documentFrequency = this.tokenStore.count(term),
      idf = 1

  if (documentFrequency > 0) {
    idf = 1 + Math.log(this.documentStore.length / documentFrequency)
  }

  return this._idfCache[cacheKey] = idf
}

/**
 * Searches the index using the passed query.
 *
 * Queries should be a string, multiple words are allowed and will lead to an
 * AND based query, e.g. `idx.search('foo bar')` will run a search for
 * documents containing both 'foo' and 'bar'.
 *
 * All query tokens are passed through the same pipeline that document tokens
 * are passed through, so any language processing involved will be run on every
 * query term.
 *
 * Each query term is expanded, so that the term 'he' might be expanded to
 * 'hello' and 'help' if those terms were already included in the index.
 *
 * Matching documents are returned as an array of objects, each object contains
 * the matching document ref, as set for this index, and the similarity score
 * for this document against the query.
 *
 * @param {String} query The query to search the index with.
 * @returns {Object}
 * @see Index.prototype.idf
 * @see Index.prototype.documentVector
 * @memberOf Index
 */
lunr.Index.prototype.search = function (query) {
  var queryTokens = this.pipeline.run(lunr.tokenizer(query)),
      queryVector = new lunr.Vector,
      documentSets = [],
      fieldBoosts = this._fields.reduce(function (memo, f) { return memo + f.boost }, 0)

  var hasSomeToken = queryTokens.some(function (token) {
    return this.tokenStore.has(token)
  }, this)

  if (!hasSomeToken) return []

  queryTokens
    .forEach(function (token, i, tokens) {
      var tf = 1 / tokens.length * this._fields.length * fieldBoosts,
          self = this

      var set = this.tokenStore.expand(token).reduce(function (memo, key) {
        var pos = self.corpusTokens.indexOf(key),
            idf = self.idf(key),
            similarityBoost = 1,
            set = new lunr.SortedSet

        // if the expanded key is not an exact match to the token then
        // penalise the score for this key by how different the key is
        // to the token.
        if (key !== token) {
          var diff = Math.max(3, key.length - token.length)
          similarityBoost = 1 / Math.log(diff)
        }

        // calculate the query tf-idf score for this token
        // applying an similarityBoost to ensure exact matches
        // these rank higher than expanded terms
        if (pos > -1) queryVector.insert(pos, tf * idf * similarityBoost)

        // add all the documents that have this key into a set
        Object.keys(self.tokenStore.get(key)).forEach(function (ref) { set.add(ref) })

        return memo.union(set)
      }, new lunr.SortedSet)

      documentSets.push(set)
    }, this)

  var documentSet = documentSets.reduce(function (memo, set) {
    return memo.intersect(set)
  })

  return documentSet
    .map(function (ref) {
      return { ref: ref, score: queryVector.similarity(this.documentVector(ref)) }
    }, this)
    .sort(function (a, b) {
      return b.score - a.score
    })
}

/**
 * Generates a vector containing all the tokens in the document matching the
 * passed documentRef.
 *
 * The vector contains the tf-idf score for each token contained in the
 * document with the passed documentRef.  The vector will contain an element
 * for every token in the indexes corpus, if the document does not contain that
 * token the element will be 0.
 *
 * @param {Object} documentRef The ref to find the document with.
 * @returns {lunr.Vector}
 * @private
 * @memberOf Index
 */
lunr.Index.prototype.documentVector = function (documentRef) {
  var documentTokens = this.documentStore.get(documentRef),
      documentTokensLength = documentTokens.length,
      documentVector = new lunr.Vector

  for (var i = 0; i < documentTokensLength; i++) {
    var token = documentTokens.elements[i],
        tf = this.tokenStore.get(token)[documentRef].tf,
        idf = this.idf(token)

    documentVector.insert(this.corpusTokens.indexOf(token), tf * idf)
  };

  return documentVector
}

/**
 * Returns a representation of the index ready for serialisation.
 *
 * @returns {Object}
 * @memberOf Index
 */
lunr.Index.prototype.toJSON = function () {
  return {
    version: lunr.version,
    fields: this._fields,
    ref: this._ref,
    documentStore: this.documentStore.toJSON(),
    tokenStore: this.tokenStore.toJSON(),
    corpusTokens: this.corpusTokens.toJSON(),
    pipeline: this.pipeline.toJSON()
  }
}

/**
 * Applies a plugin to the current index.
 *
 * A plugin is a function that is called with the index as its context.
 * Plugins can be used to customise or extend the behaviour the index
 * in some way. A plugin is just a function, that encapsulated the custom
 * behaviour that should be applied to the index.
 *
 * The plugin function will be called with the index as its argument, additional
 * arguments can also be passed when calling use. The function will be called
 * with the index as its context.
 *
 * Example:
 *
 *     var myPlugin = function (idx, arg1, arg2) {
 *       // `this` is the index to be extended
 *       // apply any extensions etc here.
 *     }
 *
 *     var idx = lunr(function () {
 *       this.use(myPlugin, 'arg1', 'arg2')
 *     })
 *
 * @param {Function} plugin The plugin to apply.
 * @memberOf Index
 */
lunr.Index.prototype.use = function (plugin) {
  var args = Array.prototype.slice.call(arguments, 1)
  args.unshift(this)
  plugin.apply(this, args)
}
/*!
 * lunr.Store
 * Copyright (C) 2015 Oliver Nightingale
 */

/**
 * lunr.Store is a simple key-value store used for storing sets of tokens for
 * documents stored in index.
 *
 * @constructor
 * @module
 */
lunr.Store = function () {
  this.store = {}
  this.length = 0
}

/**
 * Loads a previously serialised store
 *
 * @param {Object} serialisedData The serialised store to load.
 * @returns {lunr.Store}
 * @memberOf Store
 */
lunr.Store.load = function (serialisedData) {
  var store = new this

  store.length = serialisedData.length
  store.store = Object.keys(serialisedData.store).reduce(function (memo, key) {
    memo[key] = lunr.SortedSet.load(serialisedData.store[key])
    return memo
  }, {})

  return store
}

/**
 * Stores the given tokens in the store against the given id.
 *
 * @param {Object} id The key used to store the tokens against.
 * @param {Object} tokens The tokens to store against the key.
 * @memberOf Store
 */
lunr.Store.prototype.set = function (id, tokens) {
  if (!this.has(id)) this.length++
  this.store[id] = tokens
}

/**
 * Retrieves the tokens from the store for a given key.
 *
 * @param {Object} id The key to lookup and retrieve from the store.
 * @returns {Object}
 * @memberOf Store
 */
lunr.Store.prototype.get = function (id) {
  return this.store[id]
}

/**
 * Checks whether the store contains a key.
 *
 * @param {Object} id The id to look up in the store.
 * @returns {Boolean}
 * @memberOf Store
 */
lunr.Store.prototype.has = function (id) {
  return id in this.store
}

/**
 * Removes the value for a key in the store.
 *
 * @param {Object} id The id to remove from the store.
 * @memberOf Store
 */
lunr.Store.prototype.remove = function (id) {
  if (!this.has(id)) return

  delete this.store[id]
  this.length--
}

/**
 * Returns a representation of the store ready for serialisation.
 *
 * @returns {Object}
 * @memberOf Store
 */
lunr.Store.prototype.toJSON = function () {
  return {
    store: this.store,
    length: this.length
  }
}

/*!
 * lunr.stemmer
 * Copyright (C) 2015 Oliver Nightingale
 * Includes code from - http://tartarus.org/~martin/PorterStemmer/js.txt
 */

/**
 * lunr.stemmer is an english language stemmer, this is a JavaScript
 * implementation of the PorterStemmer taken from http://tartarus.org/~martin
 *
 * @module
 * @param {String} str The string to stem
 * @returns {String}
 * @see lunr.Pipeline
 */
lunr.stemmer = (function(){
  var step2list = {
      "ational" : "ate",
      "tional" : "tion",
      "enci" : "ence",
      "anci" : "ance",
      "izer" : "ize",
      "bli" : "ble",
      "alli" : "al",
      "entli" : "ent",
      "eli" : "e",
      "ousli" : "ous",
      "ization" : "ize",
      "ation" : "ate",
      "ator" : "ate",
      "alism" : "al",
      "iveness" : "ive",
      "fulness" : "ful",
      "ousness" : "ous",
      "aliti" : "al",
      "iviti" : "ive",
      "biliti" : "ble",
      "logi" : "log"
    },

    step3list = {
      "icate" : "ic",
      "ative" : "",
      "alize" : "al",
      "iciti" : "ic",
      "ical" : "ic",
      "ful" : "",
      "ness" : ""
    },

    c = "[^aeiou]",          // consonant
    v = "[aeiouy]",          // vowel
    C = c + "[^aeiouy]*",    // consonant sequence
    V = v + "[aeiou]*",      // vowel sequence

    mgr0 = "^(" + C + ")?" + V + C,               // [C]VC... is m>0
    meq1 = "^(" + C + ")?" + V + C + "(" + V + ")?$",  // [C]VC[V] is m=1
    mgr1 = "^(" + C + ")?" + V + C + V + C,       // [C]VCVC... is m>1
    s_v = "^(" + C + ")?" + v;                   // vowel in stem

  var re_mgr0 = new RegExp(mgr0);
  var re_mgr1 = new RegExp(mgr1);
  var re_meq1 = new RegExp(meq1);
  var re_s_v = new RegExp(s_v);

  var re_1a = /^(.+?)(ss|i)es$/;
  var re2_1a = /^(.+?)([^s])s$/;
  var re_1b = /^(.+?)eed$/;
  var re2_1b = /^(.+?)(ed|ing)$/;
  var re_1b_2 = /.$/;
  var re2_1b_2 = /(at|bl|iz)$/;
  var re3_1b_2 = new RegExp("([^aeiouylsz])\\1$");
  var re4_1b_2 = new RegExp("^" + C + v + "[^aeiouwxy]$");

  var re_1c = /^(.+?[^aeiou])y$/;
  var re_2 = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/;

  var re_3 = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/;

  var re_4 = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/;
  var re2_4 = /^(.+?)(s|t)(ion)$/;

  var re_5 = /^(.+?)e$/;
  var re_5_1 = /ll$/;
  var re3_5 = new RegExp("^" + C + v + "[^aeiouwxy]$");

  var porterStemmer = function porterStemmer(w) {
    var   stem,
      suffix,
      firstch,
      re,
      re2,
      re3,
      re4;

    if (w.length < 3) { return w; }

    firstch = w.substr(0,1);
    if (firstch == "y") {
      w = firstch.toUpperCase() + w.substr(1);
    }

    // Step 1a
    re = re_1a
    re2 = re2_1a;

    if (re.test(w)) { w = w.replace(re,"$1$2"); }
    else if (re2.test(w)) { w = w.replace(re2,"$1$2"); }

    // Step 1b
    re = re_1b;
    re2 = re2_1b;
    if (re.test(w)) {
      var fp = re.exec(w);
      re = re_mgr0;
      if (re.test(fp[1])) {
        re = re_1b_2;
        w = w.replace(re,"");
      }
    } else if (re2.test(w)) {
      var fp = re2.exec(w);
      stem = fp[1];
      re2 = re_s_v;
      if (re2.test(stem)) {
        w = stem;
        re2 = re2_1b_2;
        re3 = re3_1b_2;
        re4 = re4_1b_2;
        if (re2.test(w)) {  w = w + "e"; }
        else if (re3.test(w)) { re = re_1b_2; w = w.replace(re,""); }
        else if (re4.test(w)) { w = w + "e"; }
      }
    }

    // Step 1c - replace suffix y or Y by i if preceded by a non-vowel which is not the first letter of the word (so cry -> cri, by -> by, say -> say)
    re = re_1c;
    if (re.test(w)) {
      var fp = re.exec(w);
      stem = fp[1];
      w = stem + "i";
    }

    // Step 2
    re = re_2;
    if (re.test(w)) {
      var fp = re.exec(w);
      stem = fp[1];
      suffix = fp[2];
      re = re_mgr0;
      if (re.test(stem)) {
        w = stem + step2list[suffix];
      }
    }

    // Step 3
    re = re_3;
    if (re.test(w)) {
      var fp = re.exec(w);
      stem = fp[1];
      suffix = fp[2];
      re = re_mgr0;
      if (re.test(stem)) {
        w = stem + step3list[suffix];
      }
    }

    // Step 4
    re = re_4;
    re2 = re2_4;
    if (re.test(w)) {
      var fp = re.exec(w);
      stem = fp[1];
      re = re_mgr1;
      if (re.test(stem)) {
        w = stem;
      }
    } else if (re2.test(w)) {
      var fp = re2.exec(w);
      stem = fp[1] + fp[2];
      re2 = re_mgr1;
      if (re2.test(stem)) {
        w = stem;
      }
    }

    // Step 5
    re = re_5;
    if (re.test(w)) {
      var fp = re.exec(w);
      stem = fp[1];
      re = re_mgr1;
      re2 = re_meq1;
      re3 = re3_5;
      if (re.test(stem) || (re2.test(stem) && !(re3.test(stem)))) {
        w = stem;
      }
    }

    re = re_5_1;
    re2 = re_mgr1;
    if (re.test(w) && re2.test(w)) {
      re = re_1b_2;
      w = w.replace(re,"");
    }

    // and turn initial Y back to y

    if (firstch == "y") {
      w = firstch.toLowerCase() + w.substr(1);
    }

    return w;
  };

  return porterStemmer;
})();

lunr.Pipeline.registerFunction(lunr.stemmer, 'stemmer')
/*!
 * lunr.stopWordFilter
 * Copyright (C) 2015 Oliver Nightingale
 */

/**
 * lunr.stopWordFilter is an English language stop word list filter, any words
 * contained in the list will not be passed through the filter.
 *
 * This is intended to be used in the Pipeline. If the token does not pass the
 * filter then undefined will be returned.
 *
 * @module
 * @param {String} token The token to pass through the filter
 * @returns {String}
 * @see lunr.Pipeline
 */
lunr.stopWordFilter = function (token) {
  if (lunr.stopWordFilter.stopWords.indexOf(token) === -1) return token
}

lunr.stopWordFilter.stopWords = new lunr.SortedSet
lunr.stopWordFilter.stopWords.length = 119
lunr.stopWordFilter.stopWords.elements = [
  "",
  "a",
  "able",
  "about",
  "across",
  "after",
  "all",
  "almost",
  "also",
  "am",
  "among",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "but",
  "by",
  "can",
  "cannot",
  "could",
  "dear",
  "did",
  "do",
  "does",
  "either",
  "else",
  "ever",
  "every",
  "for",
  "from",
  "get",
  "got",
  "had",
  "has",
  "have",
  "he",
  "her",
  "hers",
  "him",
  "his",
  "how",
  "however",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "least",
  "let",
  "like",
  "likely",
  "may",
  "me",
  "might",
  "most",
  "must",
  "my",
  "neither",
  "no",
  "nor",
  "not",
  "of",
  "off",
  "often",
  "on",
  "only",
  "or",
  "other",
  "our",
  "own",
  "rather",
  "said",
  "say",
  "says",
  "she",
  "should",
  "since",
  "so",
  "some",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "tis",
  "to",
  "too",
  "twas",
  "us",
  "wants",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "would",
  "yet",
  "you",
  "your"
]

lunr.Pipeline.registerFunction(lunr.stopWordFilter, 'stopWordFilter')
/*!
 * lunr.trimmer
 * Copyright (C) 2015 Oliver Nightingale
 */

/**
 * lunr.trimmer is a pipeline function for trimming non word
 * characters from the begining and end of tokens before they
 * enter the index.
 *
 * This implementation may not work correctly for non latin
 * characters and should either be removed or adapted for use
 * with languages with non-latin characters.
 *
 * @module
 * @param {String} token The token to pass through the filter
 * @returns {String}
 * @see lunr.Pipeline
 */
lunr.trimmer = function (token) {
  return token
    .replace(/^\W+/, '')
    .replace(/\W+$/, '')
}

lunr.Pipeline.registerFunction(lunr.trimmer, 'trimmer')
/*!
 * lunr.stemmer
 * Copyright (C) 2015 Oliver Nightingale
 * Includes code from - http://tartarus.org/~martin/PorterStemmer/js.txt
 */

/**
 * lunr.TokenStore is used for efficient storing and lookup of the reverse
 * index of token to document ref.
 *
 * @constructor
 */
lunr.TokenStore = function () {
  this.root = { docs: {} }
  this.length = 0
}

/**
 * Loads a previously serialised token store
 *
 * @param {Object} serialisedData The serialised token store to load.
 * @returns {lunr.TokenStore}
 * @memberOf TokenStore
 */
lunr.TokenStore.load = function (serialisedData) {
  var store = new this

  store.root = serialisedData.root
  store.length = serialisedData.length

  return store
}

/**
 * Adds a new token doc pair to the store.
 *
 * By default this function starts at the root of the current store, however
 * it can start at any node of any token store if required.
 *
 * @param {String} token The token to store the doc under
 * @param {Object} doc The doc to store against the token
 * @param {Object} root An optional node at which to start looking for the
 * correct place to enter the doc, by default the root of this lunr.TokenStore
 * is used.
 * @memberOf TokenStore
 */
lunr.TokenStore.prototype.add = function (token, doc, root) {
  var root = root || this.root,
      key = token[0],
      rest = token.slice(1)

  if (!(key in root)) root[key] = {docs: {}}

  if (rest.length === 0) {
    root[key].docs[doc.ref] = doc
    this.length += 1
    return
  } else {
    return this.add(rest, doc, root[key])
  }
}

/**
 * Checks whether this key is contained within this lunr.TokenStore.
 *
 * By default this function starts at the root of the current store, however
 * it can start at any node of any token store if required.
 *
 * @param {String} token The token to check for
 * @param {Object} root An optional node at which to start
 * @memberOf TokenStore
 */
lunr.TokenStore.prototype.has = function (token) {
  if (!token) return false

  var node = this.root

  for (var i = 0; i < token.length; i++) {
    if (!node[token[i]]) return false

    node = node[token[i]]
  }

  return true
}

/**
 * Retrieve a node from the token store for a given token.
 *
 * By default this function starts at the root of the current store, however
 * it can start at any node of any token store if required.
 *
 * @param {String} token The token to get the node for.
 * @param {Object} root An optional node at which to start.
 * @returns {Object}
 * @see TokenStore.prototype.get
 * @memberOf TokenStore
 */
lunr.TokenStore.prototype.getNode = function (token) {
  if (!token) return {}

  var node = this.root

  for (var i = 0; i < token.length; i++) {
    if (!node[token[i]]) return {}

    node = node[token[i]]
  }

  return node
}

/**
 * Retrieve the documents for a node for the given token.
 *
 * By default this function starts at the root of the current store, however
 * it can start at any node of any token store if required.
 *
 * @param {String} token The token to get the documents for.
 * @param {Object} root An optional node at which to start.
 * @returns {Object}
 * @memberOf TokenStore
 */
lunr.TokenStore.prototype.get = function (token, root) {
  return this.getNode(token, root).docs || {}
}

lunr.TokenStore.prototype.count = function (token, root) {
  return Object.keys(this.get(token, root)).length
}

/**
 * Remove the document identified by ref from the token in the store.
 *
 * By default this function starts at the root of the current store, however
 * it can start at any node of any token store if required.
 *
 * @param {String} token The token to get the documents for.
 * @param {String} ref The ref of the document to remove from this token.
 * @param {Object} root An optional node at which to start.
 * @returns {Object}
 * @memberOf TokenStore
 */
lunr.TokenStore.prototype.remove = function (token, ref) {
  if (!token) return
  var node = this.root

  for (var i = 0; i < token.length; i++) {
    if (!(token[i] in node)) return
    node = node[token[i]]
  }

  delete node.docs[ref]
}

/**
 * Find all the possible suffixes of the passed token using tokens
 * currently in the store.
 *
 * @param {String} token The token to expand.
 * @returns {Array}
 * @memberOf TokenStore
 */
lunr.TokenStore.prototype.expand = function (token, memo) {
  var root = this.getNode(token),
      docs = root.docs || {},
      memo = memo || []

  if (Object.keys(docs).length) memo.push(token)

  Object.keys(root)
    .forEach(function (key) {
      if (key === 'docs') return

      memo.concat(this.expand(token + key, memo))
    }, this)

  return memo
}

/**
 * Returns a representation of the token store ready for serialisation.
 *
 * @returns {Object}
 * @memberOf TokenStore
 */
lunr.TokenStore.prototype.toJSON = function () {
  return {
    root: this.root,
    length: this.length
  }
}


  /**
   * export the module via AMD, CommonJS or as a browser global
   * Export code from https://github.com/umdjs/umd/blob/master/returnExports.js
   */
  ;(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
      // AMD. Register as an anonymous module.
      define(factory)
    } else if (typeof exports === 'object') {
      /**
       * Node. Does not work with strict CommonJS, but
       * only CommonJS-like enviroments that support module.exports,
       * like Node.
       */
      module.exports = factory()
    } else {
      // Browser globals (root is window)
      root.lunr = factory()
    }
  }(this, function () {
    /**
     * Just return a value to define the module export.
     * This example returns an object, but the module
     * can return a function as the exported value.
     */
    return lunr
  }))
})();
templates = {};
templates["autocomplete"] = function(locals) {
            var __p = [];
            var print = function() { __p.push.apply(__p,arguments); };
            
            with(locals||{}) {
              __p.push('<div class="autocomplete">\n    ',  render('autocomplete/results', {results: results}) ,'\n</div>\n\n');
            }
            
            return __p.join('');
          };templates["autocomplete/results"] = function(locals) {
            var __p = [];
            var print = function() { __p.push.apply(__p,arguments); };
            
            with(locals||{}) {
              __p.push('<ul>\n    ');  results.forEach(function(result) { ; __p.push('\n        <a href="',  result.url ,'">\n            <li>\n                <div class="type">R</div>\n                ',  result.title ,'\n            </li>\n        </a>\n    ');  }) ; __p.push('\n</ul>\n');
            }
            
            return __p.join('');
          };
//

//




recipes = [{"id":0,"url":"/recipes/amish-baked-oatmeal.html","title":"Amish Baked Oatmeal","body":"Amish Baked Oatmeal\n===================\n\nIngredients:\n------------\n\n- 1 1/2 cups Quick cooking oats\n- 1/2 cup sugar\n- 1 tsp baking powder\n- 1/2 cup milk\n- 3/4 tsp salt\n- 1/4 cup butter/marg. melted\n- 1 tsp vanilla\n- 1 egg\n\nPreparation:\n------------\n\nCombine ingredients; mix well. Spread evenly in a greased 13x9x2 dish/pan.\n\nBake 350F for 25-30 minutes or until edges are golden brown. Spoon into bowls,\nadd milk. Top with fruit and/or brown sugar.\n\nYield:\n------\n\n6 servings.\n\nSource:\n-------\nMom"},{"id":1,"url":"/recipes/banana-chip-muffins.html","title":"Banana Chip Muffins","body":"Banana Chip Muffins\n===================\n\nIngredients:\n------------\n\n- 1 egg\n- 1/2 cup oats\n- 1/3 cup vegetable oil\n- 1 tsp baking powder\n- 3/4 cup sugar\n- 1 tsp baking soda\n- 1 1/2 cups mashed bananas\n- 1/2 tsp salt\n- 2 cups flour\n- 3/4 cups mini chocolate chips\n\nPreparation:\n------------\n\nBeat egg, oil, & sugar until smooth. Stir in bananas. Combine dry ingredients\nand stir into the banana mixture, just until moistened. Stir in chocolate\nchips. Fill greased muffin cups 3/4 full. Bake 275F for 20 minutes.\n\nYield:\n------\n\n18 muffins.\n\nSource:\n-------\nMom"},{"id":2,"url":"/recipes/barbecued-chicken.html","title":"Barbecued Chicken","body":"Barbecued Chicken\n=================\n\nIngredients:\n------------\n\n- 1/2 cup water\n- 1 cup vinegar\n- 1/2 cup butter or margarine\n- 2 tbsp salt\n\nPreparation:\n------------\n\nCombine all ingredients in a saucepan. Bring to a boil. Baste each time\nchicken is turned until done.\n\nYield:\n------\n\nMixture will baste 5 lbs of chicken.\n\nSource:\n-------\nGrammy & Grampy Edgin"},{"id":3,"url":"/recipes/black-bean-burritos.html","title":"Black Bean Burritos","body":"Black Bean Burritos\n===================\n\nServe these burritos with fresh pineapple salsa or a chopped vegetable salad.\n\nIngredients:\n------------\n\n- 2 (15-ounce) cans no-salt-added black beans, drained and rinsed, or 3 cups\n  cooked beans \n- 1 tomato, chopped \n- 3 green onions, coarsely chopped \n- 1/4 cup chopped cilantro \n- 2 cups cooked brown rice \n- 4 tablespoons grated Monterey Jack or non-dairy cheese \n- 1 clove garlic, finely chopped \n- 3 tablespoons lime juice \n- 3 tablespoons canola oil \n- 1/4 teaspoon crushed red pepper \n- 1/4 teaspoon hot sauce, more to taste \n- Sea salt and ground pepper \n- 4 large whole wheat tortillas \n- 1 ripe avocado, mashed\n\nPreparation:\n------------\n\nIn a large bowl, mix together beans, tomato, green onions, cilantro, cooked\nrice and cheese. Set aside.\n\nIn a small bowl, combine garlic and lime juice. In a slow, steady stream whisk\nin oil until dressing has slightly thickened. Add crushed red pepper and salt\nto taste. Stir lime dressing into bean mixture and season with hot sauce to\ntaste. \n\nSpread 1/4 of the avocado along the center of each tortilla. Top with bean\nmixture. Fold the edges up and roll up into burritos. Serve immediately, or\nheat on a baking sheet in a 350°F oven until cheese has melted and burritos\nare heated through, about 15 minutes.\n\nYield:\n------\n\n4 servings.\n\nSource:\n-------\n[Whole Foods](http://www.wholefoodsmarket.com/recipes/1699)\n"},{"id":4,"url":"/recipes/cheese-ball.html","title":"Cheese Ball","body":"Cheese Ball\n===========\n\nIngredients:\n------------\n\n- 2 (8-ounce) packages of cream cheese \n- 2 cups cheddar cheese, shredded\n- 1 Tbsp onion, finely chopped\n- 1 Tbsp Worcestershire Sauce\n- 1 Tbsp pimento, finely chopped\n- 1 cup chopped nuts\n- dash salt\n- dash pepper\n\nPreparation:\n------------\n\nCombine all ingredients except nuts, mixing well until blended.\n\nChill for several hours.\n\nShape into ball, roll in chopped nuts. Chill and serve.\n\nYield:\n------\n\n1 large ball.\n\nSource:\n-------\nMom"},{"id":5,"url":"/recipes/chex-party-mix.html","title":"Chex Party Mix","body":"Chex Party Mix\n==============\n\nIngredients:\n------------\n\n- 6 Tbsp butter or margarine\n- 2 Tbsp Worcestershire Sauce\n- 1 1/2 tsp seasoned salt\n- 3/4 tsp garlic powder\n- 1/2 tsp onion powder\n- 3 cups Corn Chex\n- 3 cups Rice Chex\n- 3 cups Wheat Chex\n- 1 cup mixed nuts\n- 1 cup pretzels\n- 1 cup bite size bagel chips (garlic flavor)\n\nPreparation:\n------------\n\n=== Oven\nHeat oven to 250F. In large roasting pan, melt butter in oven. Stir in\nseasonings. Gradually stir in remaining ingredients until evenly coated. Bake\nfor 1 hour, stirring every 15 minutes. Spread on paper towels to cool. Store\nin airtight container.\n\n=== Microwave\nIn large microwaveable bowl, melt butter uncovered on high. Stir in seasonings,\ngradually stir in remaining ingredients until evenly coated. Microwave\nuncovered on high for 5 to 6 minutes, thoroughly stirring every 2 minutes.\n\nYield:\n------\n\n12 cups.\n\nSource:\n-------\nMom"},{"id":6,"url":"/recipes/chicken-cacciatore.html","title":"Chicken Cacciatore","body":"Chicken Cacciatore\n==================\n\nIngredients:\n------------\n\n- 1 lb chicken breast, boneless, skinless (2 cups cooked)\n- 1 Tbsp vegetable oil\n- 1 tsp salt\n- 1 sliced medium onion\n- 1/4 tsp pepper\n- 1/2 sliced green bell pepper\n- 2 cups sliced fresh mushrooms\n- 1 tsp Italian seasoning\n- 1 tsp dried basil\n- Parmesan cheese\n- 8oz wide egg noodles\n\nPreparation:\n------------\n\nCut chicken into 1 inch cubes. In a large skillet, saute' chicken in vegetable\noil until no longer pink in the center. Remove chicken from skillet and saute'\nonion, green pepper, mushrooms & garlic until onion is transparent. Add chicken\n& remaining ingredients except Parmesan cheese & noodles to the skillet. Simmer\nfor 15 minutes. Cook noodles according to pkg. directions. Place noodles &\nchicken mix in 13x9x2 baking dish. Sprinkle with Parmesan cheese. Bake at 350F\nfor 35 minutes.\n\nYield:\n------\n\n6 servings.\n\nSource:\n-------\nMom"},{"id":7,"url":"/recipes/cole-slaw.html","title":"Cole Slaw","body":"Cole Slaw\n=========\n\nIngredients:\n------------\n\n- 1/4 tsp salt\n- 4 cups grated cabbage\n- 4 tbsp sugar\n- 2 tbsp vinegar\n- 1/2 cup Hellmans mayonnaise\n- 1 tsp celery seed\n\nPreparation:\n------------\n\nMix salt, sugar, vinegar, mayonnaise, & celery seed together in small bowl.\nPour over grated cabbage.\n\nSource:\n-------\nGrammy Edgin (1.5 sauce to cabbage)\n"},{"id":8,"url":"/recipes/corn-flake-chicken.html","title":"Corn Flake Chicken","body":"Corn Flake Chicken\n==================\n\nIngredients:\n------------\n\n- 3 cups crushed Corn Flakes\n- 1/2 cup grated Parmesan cheese\n- 1/2 tsp garlic powder\n- 2 tsp salt\n- 1/2 tsp pepper\n- melted margarine or butter\n- meaty chicken pieces\n\nPreparation:\n------------\n\nDip pieces of chicken in melted butter, then in the mix of dry ingredients\nlisted above. Bake for 45 minutes on a cookie sheet at 350F. May prepare ahead.\nNo need to turn chicken.\n\nSource:\n-------\nMom"},{"id":9,"url":"/recipes/dinner-rolls.html","title":"Dinner Rolls","body":"Dinner Rolls\n============\n\nIngredients:\n------------\n\n- 2 Tbsp + 1 tsp active dry yeast\n- 3/4 tsp + 1 cup sugar divided\n- 1/2 cup warm water (110F-115F)\n- 2 cups warm milk (110F-115F)\n- 1/4 cup butter or margarine, softened\n- 2 cups mashed cooked potatoes or butternut squash\n- 2 tsp salt\n- 1/4 cup wheat germ\n- 10-11 1/2 cups flour\n- additional butter or margarine, melted\n\nPreparation:\n------------\n\nIn a large mixing bowl, dissolve yeast & 3/4 tsp sugar in warm water; let\nstand for 5 minutes. Add the milk, butter, squash or potatoes, salt &\nremaining sugar; mix until smooth.\n\nAdd wheat germ & 4 cups of flour; beat until smooth. Stir in enough remaining\nflour to form a soft dough. Turn onto a floured surface; Knead until smooth &\nelastic (about 6-8 minutes). Place in a greased bowl, turning once to grease\ntop. Cover & let rise in a warm place until doubled (about 1 hour).\n\nPunch dough down & divide into thirds; divide each portion into 20 pieces.\nShape into balls and place on greased baking sheets. Cover & let rise until\ndoubled (about 30 minutes).\n\nBake at 250F for 15-17 minutes or until golden brown.\n\nBrush with butter. Remove to wire racks.\n\nYield:\n------\n\n5 dozen rolls.\n\nSource:\n-------\nMom"},{"id":10,"url":"/recipes/eggnog.html","title":"Eggnog","body":"Eggnog\n======\n\nIngredients:\n------------\n\n- 1/3 cup sugar\n- 1 tsp vanilla\n- 2 egg yolks\n- 1/2 cup whipping cream, whipped\n- 1/4 tsp salt\n- 4 cups milk\n- 2 egg whites\n- ground nutmeg\n\nPreparation:\n------------\n\nBeat 1/3 cup sugar into egg yolks. Add salt; stir in milk. Cook over medium\nheat, stirring constantly until mixture coats spoon (about 15 minutes). Cool.\n\nBeat egg whites until foamy. Gradually add Tbsp sugar; beating to soft peaks.\nAdd to custard and mix thoroughly. Add vanilla. Chill 3-4 hours. Pour into\ncups. Dot with islands of whipped cream; dash with nutmeg.\n\nYield:\n------\n\n6 to 8 servings.\n\nSource:\n-------\nMom"},{"id":11,"url":"/recipes/light-n-crisp-waffles.html","title":"Light N Crisp Waffles","body":"Light N Crisp Waffles\n=====================\n\nIngredients:\n------------\n\n- 2 egg yolks\n- 1/2 tsp salt\n- 2 cups milk\n- 1/3 cup oil\n- 2 cups flour\n- 2 egg whites (stiffly beaten)\n- 1 Tbsp baking powder\n\nPreparation:\n------------\n\nPut all ingredients except whites in a large mixer bowl. Preheat waffle maker.\nBeat on low until moistened. Increase to medium and mix until smooth. By hand\nfold in egg whites.\n\nPour 1/2 cup batter over center of grids. Bake for about 2 minutes.\n\nSource:\n-------\nMom\n"},{"id":12,"url":"/recipes/maple-syrup.html","title":"Maple Syrup","body":"Maple Syrup\n===========\n\nIngredients:\n------------\n\n- 1 3/4 cup white sugar\n- 1/4 cup brown sugar\n- 1 cup water\n- 1/2 teaspoon vanilla\n- 1/2 teaspoon maple flavoring\n\nPreparation:\n------------\nCombine white sugar, brown sugar, and water in saucepan. Bring to a boil, cover,\nand cook for 1 minute.\n\nCool slightly and add the vanilla and maple flavoring.\n\nCover saucepan for a few minutes as syrup cooks to melt down crystals; helps to\nprevent syrup from crystallizing later in storage.\n\nSource:\n-------\nElsie Epp of Marion, South Dakota in the More-with-less cookbook\n"},{"id":13,"url":"/recipes/ohio-buckeye-candy.html","title":"Ohio Buckeye Candy","body":"Ohio Buckeye Candy\n==================\n\nIngredients:\n------------\n\n- 3 cups creamy peanut butter\n- 1 1/2 sticks softened butter\n- 2 lbs. confectioner's sugar\n- 16 oz melted dipping chocolate\n\nPreparation:\n------------\n\nMix together peanut butter, butter and confectioner's sugar. Form into small\nballs. Using a toothpick dip balls into chocolate until almost covered, leaving\nsome of the peanut butter mixture exposed on top. Refrigerate.\n\nSource:\n-------\nMom"},{"id":14,"url":"/recipes/puff-eggs-soup.html","title":"Puff Eggs Soup","body":"Puff Eggs Soup\n==============\n\nIngredients:\n------------\n\n- 2 eggs\n- 1/2 tsp salt\n- 1 stalk green onion, chopped\n- 4 cups broth\n\nPreparation:\n------------\n\nBeat eggs with salt & onion. Heat wok to a high temperature. Add in 1 tsp oil\nand pour in beaten eggs. When the bottom side is firm, turn to other side.\nAfter another 10 seconds, add in broth. Bring to a boil & serve.\n\nSource:\n-------\nMom"},{"id":15,"url":"/recipes/slow-cooked-country-style-ribs.html","title":"Slow Cooked Country Style Ribs","body":"Slow Cooked Barbecued Country-Style Ribs\n========================================\n\nBoneless country-style pork ribs are a great meat for the slow cooker,\nand your favorite barbecue sauce and a little apple juice and garlic makes\nthese ribs extra-flavorful. The pork ribs are cooked with brown sugar, onions,\napple juice, garlic, and other seasonings, then they're finished with\npurchasedbarbecue sauce.\n\nIngredients:\n------------\n\n- 3 to 4 pounds boneless pork country-style ribs\n- 1/2 teaspoon salt\n- 1/4 teaspoon ground black pepper\n- 1/4 cup light brown sugar, packed\n- 2 cloves garlic, minced\n- 1 large onion, halved, thinly sliced\n- 1/2 cup apple juice\n- 1 bottle (16 to 18 ounces) barbecue sauce, about 1 1/2 cups\n\nPreparation:\n------------\n\nLightly grease the crockery insert of a 5 to 6-quart slow cooker. Wash pork,\ntrim excess fat and pat dry with paper towels. Put the sliced onions in the\nbottom of the slow cooker, then place pork on top. Sprinkle the pork with salt\nand pepper, brown sugar, and minced garlic; turn the pork ribs to coat all\npieces. Pour apple juice evenly over the pork. Cover and cook on LOW for 8 to\n9 hours. Drain liquids from the pork. Pour barbecue sauce over the pork and\nstir slightly to distribute the sauce. Cover and cook on LOW for 1 hour longer.\n\nYield:\n------\n\n6 to 8 servings.\n\nSource:\n-------\n[About.com](http://southernfood.about.com/od/crockpotporkandham/r/r80418g.htm)\n"},{"id":16,"url":"/recipes/slow-cooker-chili.html","title":"Slow Cooker Chili","body":"Slow Cooker Chili\n=================\n\nIngredients:\n------------\n\n- 2 lbs ground beef\n- 1 1/2 cups chopped onion\n- 1 cup chopped green pepper\n- 2 garlic cloves, finely cut\n- 1 (28oz) can tomatoes, undrained\n- 2 (16oz) cans kidney beans, undrained\n- 2 tsp salt\n- 2 Tbsp chili powder\n- 1tsp cumin\n- 1tsp pepper\n\nPreparation:\n------------\n\nBrown ground beef. Add onion, green pepper, garlic, tomatoes, kidney beans,\nsalt, chili powder, pepper & cumin. Stir to combine. Cover & simmer on low for\n6-9 hours.\n\nYield:\n------\n\n8 to 10 servings.\n\nSource:\n-------\nMom"},{"id":17,"url":"/recipes/sunrise-shake.html","title":"Sunrise Shake","body":"Sunrise Shake\n=============\n\nIngredients:\n------------\n\n- 1 cup orange juice\n- 1 peeled banana\n- 1/2 cup plain yogurt\n- 2 tsp sugar\n- 1/8 tsp. vanilla\n- 1/4 cup instant nonfat dry milk\n\nYield:\n------\n\n1 serving.\n\nSource:\n-------\nMom"},{"id":18,"url":"/recipes/supper-a-la-king.html","title":"Supper A La King","body":"Supper a la King\n================\n\nServe these burritos with fresh pineapple salsa or a chopped vegetable salad.\n\nIngredients:\n------------\n\n- 1/4 cup butter or margarine\n- 1/2 cup diced green pepper\n- 1/3 cup chopped onion\n- 1 can (10 3/4 ounces) condensed soup (cream of chicken or cream of\n  asparagus or cream of mushroom or cream of celery)\n- 3/4 cup milk\n- 2 cups cubed cooked meat (chicken or ham or turkey or kielbasa)\n- 3/4 cup shredded cheese (swiss, cheddar, muenster or american)\n- 1/4 cup diced pimento\n- Accompaniment (shredded zucchini, cooked and drained or baked potatoes,\n  split or cooked spaghetti squash or biscuits, split)\n\nPreparation:\n------------\n\nIn 10-inch skillet over medium heat, in hot butter, cook green pepper and\nonion until tender, stirring occasionally. Stir in soup and milk; blend\nwell. Stir in meat, cheese and pimento. Cook 5 minutes more or until heated\nthrough.\n\nArrange accompaniment on serving platter. Serve sauce over accompaniment.\n\nTo Microwave: Use ingredients as above but use only 2 tablespoons butter.\nIn 2-quart microwave-safe casserole, combine only 2 tablespoons butter,\ngreen pepper and onion; cover. Microwave on high 2 to 3 minutes until\nvegetables are tender. Stir in soup and milk; blend well. Stir in meat,\ncheese and pimento; cover. Microwave on high 7 to 9 minutes until heated\nthrough, stirring occasionally. Serve as above.\n\nYield:\n------\n\nMakes about 3 1/2 cups sauce, 6 servings.\n\nSource:\n-------\nMom"},{"id":19,"url":"/recipes/taco-soup.html","title":"Taco Soup","body":"Taco Soup\n=========\n\nIngredients:\n------------\n\n- 1 pound of Ground Beef\n- 1/2 an onion\n- 1 package of taco seasoning\n- 1 package of Ranch dressing mix\n- 2 cans of stewed tomatoes\n- 1 small can of tomato sauce\n- 1 can of Rotel\n- 1 can of corn\n- 1 cans of pinto or black beans\n\nPreparation:\n------------\n\nChop the onion and brown the beef and onions together. Drain, then add taco\nand ranch dressing mix. Squish or chop the tomatoes. Pour all the cans in.\nSimmer for 30+ minutes.\n\nYield:\n------\n\n6 to 8 servings.\n\nSource:\n-------\nEmily Ehmke\n"},{"id":20,"url":"/recipes/thai-peanut-chicken.html","title":"Thai Peanut Chicken","body":"Thai Peanut Chicken\n===================\n\nIngredients:\n------------\n\n- 1lb chicken breast, boneless, skinless (sliced)\n- 1/4 kraft catalina dressing, divided\n- 1 can (14.5oz) chicken broth\n- 2 Tbsp soy sauce\n- 1 Tbsp peanut butter\n- 8oz spaghetti, broken, uncooked\n- 2 cups broccoli floret\n- 1 cup thin carrot slices\n\nPreparation:\n------------\n\nHeat 2 Tbsp of the dressing in large skillet on medium heat. Add chicken; cook\n& stir 5 minutes or until cooked through.\n\nAdd remaining 2 Tbsp dressing. 1 1/2 cups water, chicken broth, soy sauce &\npeanut butter. Bring to a boil. Add spaghetti; cover. Reduce heat to med-low, \nsimmer for 5 minutes.\n\nStir in broccoli & carrots; cover. Simmer 4-6 minutes or until spaghetti is\ntender. Serve immediately or cover & refrigerate until ready to serve.\n\nYield:\n------\n\n4 servings.\n\nSource:\n-------\nMom"},{"id":21,"url":"/recipes/thai-style-chicken.html","title":"Thai Style Chicken","body":"Thai Style Chicken with Shells\n==============================\n\nIngredients:\n------------\n\n- 16oz pkg large shell pasta\n- salt\n- 3/4 lb green beans, trimmed\n- 1 Tbsp olive oil\n- 1 lb skinless, boneless chicken breast halves\n- 2 Tbsp grated,peeled fresh ginger (or 2tsp dry ginger), thinly sliced\n- 2 garlic gloves, minced\n- 1/4 cup chopped fresh cilantro\n- 1/8 - 1/4 tsp crushed red pepper\n- 1 (14oz) can light coconut milk (not cream of coconut)\n- 2 Tbsp lemon juice\n\nPreparation:\n------------\n\nIn large pot of boiling salted water cook pasta as label directs. After pasta\nhas cooked 5 minutes add green beans.\n\nHeat olive oil in skillet, over med-high heat; add chicken & cook 2 minutes\nuntil not pink. Add ginger, garlic, crushed red pepper, & 3/4 tsp salt,\nstirring constantly about 30 seconds. Stir in coconut milk & lemon juice. Heat\nuntil boiling.\n\nDrain pasta & beans, return to pot. Add coconut milk mix & cilantro; toss well.\n\nSource:\n-------\nMom"},{"id":22,"url":"/recipes/tilapia.html","title":"Tilapia","body":"Tilapia\n=======\n\nIngredients:\n------------\n\n- Paprika\n- Black Pepper\n- Lemon Juice\n- Cyane Pepper\n- Creole seasoning.\n\nPreparation:\n------------\n\nPut tilapia on a pan and cover in ingredients. Cook.\n\nSource:\n-------\nSandy\n"},{"id":23,"url":"/recipes/tuna-macaroni-salad.html","title":"Tuna Macaroni Salad","body":"Tuna Macaroni Salad\n==================\n\nIngredients:\n------------\n\n- 16 oz. box of shells, cooked\n- 2 cans of tuna\n- 1 onion (about 1/2 cup)\n- 1/2 green pepper\n- 2/3 cup celery\n- 2 tsp. salt\n- 1/2 tsp. pepper\n- 2 cups mayonnaise\n\nSource:\n-------\nGrammy Edgin"},{"id":24,"url":"/recipes/waffles.html","title":"Waffles","body":"Waffles\n=======\n\nIngredients:\n------------\n\n- 2 egg yolks\n- 2 cups milk\n- 2 cups flour\n- 1 Tbsp baking powder\n- 1/2 tsp salt\n- 1/3 cup oil\n- 2 egg white (stiffly beaten)\n\nPreparation:\n------------\n\nPreheat waffle maker. Put all ingredients except egg whites in a large mixing\nbowl. Beat on low until moistened. Up speed to medium, mix until smooth. By hand\nfold in egg whites. Pour 1/2 cup batter over center of grids. Bake for 2 mins.\n\nSource:\n-------\nMom"},{"id":25,"url":"/recipes/wassail.html","title":"Wassail","body":"Wassail\n=======\n\nPrep Time\n---------\n15 Minutes\n\nCook Time\n---------\n3 Hours\n\nIngredients:\n------------\n\n- 1 Gallon Apple Cider\n- 2 Cups of Pineapple Juice\n- 1/2 a Cup of Honey\n- 1/2 a Cup of Sugar\n- 2 Oranges\n- Whole Cloves\n- 1 Apple, peeled and diced\n- Allspice\n- Ginger\n- Nutmeg\n- 3 Cinnamon Sticks (or 3 Tbs. ground cinnamon)\n- 1/2 Cup to 1 Cup of Brandy (optional)\n\nPreparation:\n------------\n\nSet crockpot to its lower setting, and pour apple cider, pineapple juice,\nhoney and sugar in, mixing carefully. As it heats up, stir so that the\nhoney and sugar dissolve. Stud the oranges with the cloves (~6 cloves),\nand place in the pot (they'll float). Add the diced apple. Add allspice,\nginger and nutmeg to taste -- usually a couple of tablespoons of each is\nplenty. Finally, snap the cinnamon sticks in half and add those as well.\n\nCover your pot and allow to simmer 2 - 4 hours on low heat. About half\nan hour prior to serving, add the brandy if you choose to use it.\n\nSource:\n-------\nBen Ehmke\n"}];

lr = lunr.Index.load(
{"version":"0.5.11","fields":[{"name":"title","boost":10},{"name":"body","boost":1}],"ref":"id","documentStore":{"store":{"0":["1","1/2","1/4","13x9x2","25","3/4","30","350f","6","add","amish","and/or","bake","bowl","brown","butter/marg","combin","cook","cup","dish/pan","edg","egg","evenli","fruit","golden","greas","ingredi","melt","milk","minut","mix","mom","oat","oatmeal","powder","prepar","quick","salt","serv","sourc","spoon","spread","sugar","top","tsp","until","vanilla","well","yield"],"1":["1","1/2","1/3","18","2","20","275f","3/4","bake","banana","beat","chip","chocol","combin","cup","dri","egg","fill","flour","full","greas","ingredi","mash","mini","minut","mixtur","moisten","mom","muffin","oat","oil","powder","prepar","salt","smooth","soda","sourc","stir","sugar","tsp","until","veget","yield"],"2":["1","1/2","2","5","barbecu","bast","boil","bring","butter","chicken","combin","cup","done","each","edgin","grammi","grampi","ingredi","lb","margarin","mixtur","prepar","salt","saucepan","sourc","tbsp","time","turn","until","vinegar","water","yield"],"3":["1","1/4","15","2","3","350°f","4","ad","add","along","asid","avocado","bake","bean","black","bowl","brown","burrito","can","canola","center","chees","chop","cilantro","clove","coars","combin","cook","crush","cup","dairi","drain","dress","each","edg","fine","fold","foods](http://www.wholefoodsmarket.com/recipes/1699","fresh","garlic","grate","green","ground","heat","hot","immedi","ingredi","jack","juic","larg","lime","mash","melt","minut","mix","mixtur","monterey","more","non","oil","onion","ounc","oven","pepper","pineappl","prepar","red","rice","rins","ripe","roll","salad","salsa","salt","sauc","sea","season","serv","set","sheet","slightli","slow","small","sourc","spread","steadi","stir","stream","tablespoon","tast","teaspoon","thicken","through","togeth","tomato","top","tortilla","until","up","veget","wheat","whisk","whole","yield"],"4":["1","2","8","ball","blend","cheddar","chees","chill","chop","combin","cream","cup","dash","except","fine","hour","ingredi","larg","mix","mom","nut","onion","ounc","packag","pepper","pimento","prepar","roll","salt","sauc","serv","sever","shape","shred","sourc","tbsp","until","well","worcestershir","yield"],"5":["1","1/2","12","15","2","250f","3","3/4","5","6","airtight","bagel","bake","bite","bowl","butter","chex","chip","coat","contain","cool","corn","cup","evenli","flavor","garlic","gradual","heat","high","hour","ingredi","larg","margarin","melt","microwav","minut","mix","mom","nut","onion","oven","pan","paper","parti","powder","prepar","pretzel","remain","rice","roast","salt","sauc","season","size","sourc","spread","stir","store","tbsp","thoroughli","towel","tsp","uncov","until","wheat","worcestershir","yield"],"6":["1","1/2","1/4","13x9x2","15","2","35","350f","6","8oz","accord","add","bake","basil","bell","boneless","breast","cacciator","center","chees","chicken","cook","cube","cup","cut","direct","dish","dri","egg","except","fresh","garlic","green","inch","ingredi","italian","larg","lb","longer","medium","minut","mix","mom","mushroom","noodl","oil","onion","parmesan","pepper","pink","pkg","place","prepar","remain","remov","salt","saut","season","serv","simmer","skillet","skinless","slice","sourc","sprinkl","tbsp","transpar","tsp","until","veget","wide","yield"],"7":["1","1.5","1/2","1/4","2","4","bowl","cabbag","celeri","cole","cup","edgin","grammi","grate","hellman","ingredi","mayonnais","mix","over","pour","prepar","salt","sauc","seed","slaw","small","sourc","sugar","tbsp","togeth","tsp","vinegar"],"8":["1/2","2","3","350f","45","abov","ahead","bake","butter","chees","chicken","cooki","corn","crush","cup","dip","dri","flake","garlic","grate","ingredi","list","margarin","meati","melt","minut","mix","mom","need","parmesan","pepper","piec","powder","prepar","salt","sheet","sourc","tsp","turn"],"9":["1","1/2","1/4","10","11","110f","115f","15","17","2","20","250f","3/4","30","4","5","6","8","activ","add","addit","bake","ball","beat","bowl","brown","brush","butter","butternut","cook","cover","cup","dinner","dissolv","divid","doubl","dough","down","dozen","dri","each","elast","enough","flour","form","germ","golden","greas","hour","ingredi","knead","larg","margarin","mash","melt","milk","minut","mix","mom","onc","onto","piec","place","portion","potato","prepar","punch","rack","remain","remov","rise","roll","salt","shape","sheet","smooth","soft","soften","sourc","squash","stand","stir","sugar","surfac","tbsp","third","top","tsp","turn","until","warm","water","wheat","wire","yeast","yield"],"10":["1","1/2","1/3","1/4","15","2","3","4","6","8","add","beat","chill","coat","constantli","cook","cool","cream","cup","custard","dash","dot","egg","eggnog","foami","gradual","ground","heat","hour","ingredi","island","medium","milk","minut","mix","mixtur","mom","nutmeg","over","peak","pour","prepar","salt","serv","soft","sourc","spoon","stir","sugar","tbsp","thoroughli","tsp","until","vanilla","whip","white","yield","yolk"],"11":["1","1/2","1/3","2","bake","batter","beat","beaten","bowl","center","crisp","cup","egg","except","flour","fold","grid","hand","increas","ingredi","larg","light","low","maker","medium","milk","minut","mix","mixer","moisten","mom","n","oil","over","pour","powder","preheat","prepar","put","salt","smooth","sourc","stiffli","tbsp","tsp","until","waffl","white","yolk"],"12":["1","1/2","1/4","3/4","add","boil","bring","brown","combin","cook","cookbook","cool","cover","crystal","cup","dakota","down","elsi","epp","few","flavor","help","ingredi","later","less","mapl","marion","melt","minut","more","prepar","prevent","saucepan","slightli","sourc","south","storag","sugar","syrup","teaspoon","vanilla","water","white"],"13":["1","1/2","16","2","3","ball","buckey","butter","candi","chocol","confectioner'","cover","creami","cup","dip","expos","form","ingredi","lb","leav","melt","mix","mixtur","mom","ohio","oz","peanut","prepar","refriger","small","soften","sourc","stick","sugar","togeth","toothpick","top","until","us"],"14":["1","1/2","10","2","4","add","anoth","beat","beaten","boil","bottom","bring","broth","chop","cup","egg","firm","green","heat","high","ingredi","mom","oil","onion","pour","prepar","puff","salt","second","serv","side","soup","sourc","stalk","temperatur","tsp","turn","wok"],"15":["1","1/2","1/4","16","18","2","3","4","5","6","8","9","about.com](http://southernfood.about.com/od/crockpotporkandham/r/r80418g.htm","appl","barbecu","black","boneless","bottl","bottom","brown","clove","coat","cook","cooker","countri","cover","crockeri","cup","distribut","drain","dri","evenli","excess","extra","fat","favorit","finish","flavor","garlic","greas","great","ground","halv","hour","ingredi","insert","juic","larg","light","lightli","liquid","littl","longer","low","make","meat","minc","onion","ounc","over","pack","paper","pat","pepper","piec","place","pork","pound","pour","prepar","purchasedbarbecu","put","quart","rib","salt","sauc","season","serv","slice","slightli","slow","sourc","sprinkl","stir","style","sugar","teaspoon","they'r","thinli","top","towel","trim","turn","wash","yield"],"16":["1","1/2","10","16oz","1tsp","2","28oz","6","8","9","add","bean","beef","brown","can","chili","chop","clove","combin","cooker","cover","cumin","cup","cut","fine","garlic","green","ground","hour","ingredi","kidney","lb","low","mom","onion","pepper","powder","prepar","salt","serv","simmer","slow","sourc","stir","tbsp","tomato","tsp","undrain","yield"],"17":["1","1/2","1/4","1/8","2","banana","cup","dri","ingredi","instant","juic","milk","mom","nonfat","orang","peel","plain","serv","shake","sourc","sugar","sunris","tsp","vanilla","yield","yogurt"],"18":["1","1/2","1/3","1/4","10","2","3","3/4","5","6","7","9","abov","accompani","american","arrang","asparagu","bake","biscuit","blend","burrito","butter","casserol","celeri","cheddar","chees","chicken","chop","combin","condens","cook","cover","cream","cube","cup","dice","drain","fresh","green","ham","heat","high","hot","inch","ingredi","kielbasa","king","la","make","margarin","meat","medium","microwav","milk","minut","mom","more","muenster","mushroom","occasion","onion","ounc","over","pepper","pimento","pineappl","platter","potato","prepar","quart","safe","salad","salsa","sauc","serv","shred","skillet","soup","sourc","spaghetti","split","squash","stir","supper","swiss","tablespoon","tender","through","turkey","until","us","veget","well","yield","zucchini"],"19":["1","1/2","2","30","6","8","add","bean","beef","black","brown","can","chop","corn","drain","dress","ehmk","emili","ground","ingredi","minut","mix","onion","packag","pinto","pound","pour","prepar","ranch","rotel","sauc","season","serv","simmer","small","soup","sourc","squish","stew","taco","togeth","tomato","yield"],"20":["1","1/2","1/4","14.5oz","1lb","2","4","5","6","8oz","add","boil","boneless","breast","bring","broccoli","broken","broth","butter","carrot","catalina","chicken","cook","cover","cup","divid","dress","floret","heat","immedi","ingredi","kraft","larg","low","med","medium","minut","mom","peanut","prepar","readi","reduc","refriger","remain","sauc","serv","simmer","skillet","skinless","slice","sourc","soy","spaghetti","stir","tbsp","tender","thai","thin","through","uncook","until","water","yield"],"21":["1","1/4","1/8","14oz","16oz","2","2tsp","3/4","30","5","add","bean","boil","boneless","breast","chicken","chop","cilantro","coconut","constantli","cook","cream","crush","cup","direct","drain","dri","fresh","garlic","ginger","glove","grated,peel","green","halv","heat","high","ingredi","juic","label","larg","lb","lemon","light","med","milk","minc","minut","mix","mom","oil","oliv","over","pasta","pepper","pink","pkg","pot","prepar","red","return","salt","second","shell","skillet","skinless","slice","sourc","stir","style","tbsp","thai","thinli","toss","trim","tsp","until","water","well"],"22":["black","cook","cover","creol","cyan","ingredi","juic","lemon","pan","paprika","pepper","prepar","put","sandi","season","sourc","tilapia"],"23":["1","1/2","16","2","2/3","box","can","celeri","cook","cup","edgin","grammi","green","ingredi","macaroni","mayonnais","onion","oz","pepper","salad","salt","shell","sourc","tsp","tuna"],"24":["1","1/2","1/3","2","bake","batter","beat","beaten","bowl","center","cup","egg","except","flour","fold","grid","hand","ingredi","larg","low","maker","medium","milk","min","mix","moisten","mom","oil","over","pour","powder","preheat","prepar","put","salt","smooth","sourc","speed","stiffli","tbsp","tsp","until","up","waffl","white","yolk"],"25":["1","1/2","15","2","3","4","6","add","allow","allspic","appl","ben","brandi","carefulli","choos","cider","cinnamon","clove","cook","coupl","cover","crockpot","cup","dice","dissolv","each","ehmk","final","float","gallon","ginger","ground","half","heat","honey","hour","ingredi","juic","low","lower","minut","mix","nutmeg","option","orang","peel","pineappl","place","plenti","pot","pour","prep","prepar","prior","serv","set","simmer","snap","sourc","stick","stir","stud","sugar","tablespoon","tast","tb","they'll","those","time","up","us","usual","wassail","well","whole"]},"length":26},"tokenStore":{"root":{"1":{"0":{"docs":{"9":{"ref":9,"tf":0.006097560975609756},"14":{"ref":14,"tf":0.020833333333333332},"16":{"ref":16,"tf":0.013333333333333334},"18":{"ref":18,"tf":0.011235955056179775}}},"1":{"0":{"docs":{},"f":{"docs":{"9":{"ref":9,"tf":0.012195121951219513}}}},"5":{"docs":{},"f":{"docs":{"9":{"ref":9,"tf":0.012195121951219513}}}},"docs":{"9":{"ref":9,"tf":0.006097560975609756}}},"2":{"docs":{"5":{"ref":5,"tf":0.008547008547008548}}},"3":{"docs":{},"x":{"9":{"docs":{},"x":{"2":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"6":{"ref":6,"tf":0.008771929824561403}}},"docs":{}}},"docs":{}}},"4":{"docs":{},".":{"5":{"docs":{},"o":{"docs":{},"z":{"docs":{"20":{"ref":20,"tf":0.009259259259259259}}}}},"docs":{}},"o":{"docs":{},"z":{"docs":{"21":{"ref":21,"tf":0.007692307692307693}}}}},"5":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"5":{"ref":5,"tf":0.008547008547008548},"6":{"ref":6,"tf":0.008771929824561403},"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.011494252873563218},"25":{"ref":25,"tf":0.00847457627118644}}},"6":{"docs":{"13":{"ref":13,"tf":0.02},"15":{"ref":15,"tf":0.006097560975609756},"23":{"ref":23,"tf":0.029411764705882353}},"o":{"docs":{},"z":{"docs":{"16":{"ref":16,"tf":0.013333333333333334},"21":{"ref":21,"tf":0.007692307692307693}}}}},"7":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}},"8":{"docs":{"1":{"ref":1,"tf":0.013333333333333334},"15":{"ref":15,"tf":0.006097560975609756}}},"docs":{"0":{"ref":0,"tf":0.06153846153846154},"1":{"ref":1,"tf":0.05333333333333334},"2":{"ref":2,"tf":0.02564102564102564},"3":{"ref":3,"tf":0.01764705882352941},"4":{"ref":4,"tf":0.08196721311475409},"5":{"ref":5,"tf":0.042735042735042736},"6":{"ref":6,"tf":0.06140350877192982},"7":{"ref":7,"tf":0.022222222222222223},"9":{"ref":9,"tf":0.018292682926829267},"10":{"ref":10,"tf":0.011494252873563218},"11":{"ref":11,"tf":0.015384615384615385},"12":{"ref":12,"tf":0.045454545454545456},"13":{"ref":13,"tf":0.02},"14":{"ref":14,"tf":0.041666666666666664},"15":{"ref":15,"tf":0.024390243902439025},"16":{"ref":16,"tf":0.04},"17":{"ref":17,"tf":0.0967741935483871},"18":{"ref":18,"tf":0.0056179775280898875},"19":{"ref":19,"tf":0.1111111111111111},"20":{"ref":20,"tf":0.037037037037037035},"21":{"ref":21,"tf":0.023076923076923078},"23":{"ref":23,"tf":0.029411764705882353},"24":{"ref":24,"tf":0.015625},"25":{"ref":25,"tf":0.025423728813559324}},"/":{"2":{"docs":{"0":{"ref":0,"tf":0.046153846153846156},"1":{"ref":1,"tf":0.04},"2":{"ref":2,"tf":0.05128205128205128},"5":{"ref":5,"tf":0.017094017094017096},"6":{"ref":6,"tf":0.008771929824561403},"7":{"ref":7,"tf":0.022222222222222223},"8":{"ref":8,"tf":0.05555555555555555},"9":{"ref":9,"tf":0.012195121951219513},"10":{"ref":10,"tf":0.011494252873563218},"11":{"ref":11,"tf":0.03076923076923077},"12":{"ref":12,"tf":0.030303030303030304},"13":{"ref":13,"tf":0.02},"14":{"ref":14,"tf":0.020833333333333332},"15":{"ref":15,"tf":0.018292682926829267},"16":{"ref":16,"tf":0.013333333333333334},"17":{"ref":17,"tf":0.03225806451612903},"18":{"ref":18,"tf":0.011235955056179775},"19":{"ref":19,"tf":0.015873015873015872},"20":{"ref":20,"tf":0.009259259259259259},"23":{"ref":23,"tf":0.08823529411764706},"24":{"ref":24,"tf":0.03125},"25":{"ref":25,"tf":0.025423728813559324}}},"3":{"docs":{"1":{"ref":1,"tf":0.013333333333333334},"10":{"ref":10,"tf":0.022988505747126436},"11":{"ref":11,"tf":0.015384615384615385},"18":{"ref":18,"tf":0.0056179775280898875},"24":{"ref":24,"tf":0.015625}}},"4":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"3":{"ref":3,"tf":0.023529411764705882},"6":{"ref":6,"tf":0.008771929824561403},"7":{"ref":7,"tf":0.022222222222222223},"9":{"ref":9,"tf":0.012195121951219513},"10":{"ref":10,"tf":0.011494252873563218},"12":{"ref":12,"tf":0.015151515151515152},"15":{"ref":15,"tf":0.012195121951219513},"17":{"ref":17,"tf":0.03225806451612903},"18":{"ref":18,"tf":0.011235955056179775},"20":{"ref":20,"tf":0.009259259259259259},"21":{"ref":21,"tf":0.015384615384615385}}},"8":{"docs":{"17":{"ref":17,"tf":0.03225806451612903},"21":{"ref":21,"tf":0.007692307692307693}}},"docs":{}},".":{"5":{"docs":{"7":{"ref":7,"tf":0.022222222222222223}}},"docs":{}},"t":{"docs":{},"s":{"docs":{},"p":{"docs":{"16":{"ref":16,"tf":0.02666666666666667}}}}},"l":{"docs":{},"b":{"docs":{"20":{"ref":20,"tf":0.009259259259259259}}}}},"2":{"0":{"docs":{"1":{"ref":1,"tf":0.013333333333333334},"9":{"ref":9,"tf":0.006097560975609756}}},"5":{"0":{"docs":{},"f":{"docs":{"5":{"ref":5,"tf":0.008547008547008548},"9":{"ref":9,"tf":0.006097560975609756}}}},"docs":{"0":{"ref":0,"tf":0.015384615384615385}}},"7":{"5":{"docs":{},"f":{"docs":{"1":{"ref":1,"tf":0.013333333333333334}}}},"docs":{}},"8":{"docs":{},"o":{"docs":{},"z":{"docs":{"16":{"ref":16,"tf":0.013333333333333334}}}}},"docs":{"1":{"ref":1,"tf":0.013333333333333334},"2":{"ref":2,"tf":0.02564102564102564},"3":{"ref":3,"tf":0.011764705882352941},"4":{"ref":4,"tf":0.03278688524590164},"5":{"ref":5,"tf":0.017094017094017096},"6":{"ref":6,"tf":0.017543859649122806},"7":{"ref":7,"tf":0.022222222222222223},"8":{"ref":8,"tf":0.018518518518518517},"9":{"ref":9,"tf":0.024390243902439025},"10":{"ref":10,"tf":0.022988505747126436},"11":{"ref":11,"tf":0.07692307692307693},"13":{"ref":13,"tf":0.02},"14":{"ref":14,"tf":0.020833333333333332},"15":{"ref":15,"tf":0.006097560975609756},"16":{"ref":16,"tf":0.06666666666666667},"17":{"ref":17,"tf":0.03225806451612903},"18":{"ref":18,"tf":0.028089887640449437},"19":{"ref":19,"tf":0.015873015873015872},"20":{"ref":20,"tf":0.037037037037037035},"21":{"ref":21,"tf":0.03076923076923077},"23":{"ref":23,"tf":0.08823529411764706},"24":{"ref":24,"tf":0.078125},"25":{"ref":25,"tf":0.025423728813559324}},"t":{"docs":{},"s":{"docs":{},"p":{"docs":{"21":{"ref":21,"tf":0.007692307692307693}}}}},"/":{"3":{"docs":{"23":{"ref":23,"tf":0.029411764705882353}}},"docs":{}}},"3":{"0":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"9":{"ref":9,"tf":0.006097560975609756},"19":{"ref":19,"tf":0.015873015873015872},"21":{"ref":21,"tf":0.007692307692307693}}},"5":{"0":{"docs":{},"f":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"6":{"ref":6,"tf":0.008771929824561403},"8":{"ref":8,"tf":0.018518518518518517}}},"°":{"docs":{},"f":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}}}},"docs":{"6":{"ref":6,"tf":0.008771929824561403}}},"docs":{"3":{"ref":3,"tf":0.023529411764705882},"5":{"ref":5,"tf":0.02564102564102564},"8":{"ref":8,"tf":0.018518518518518517},"10":{"ref":10,"tf":0.011494252873563218},"13":{"ref":13,"tf":0.02},"15":{"ref":15,"tf":0.006097560975609756},"18":{"ref":18,"tf":0.011235955056179775},"25":{"ref":25,"tf":0.025423728813559324}},"/":{"4":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"1":{"ref":1,"tf":0.04},"5":{"ref":5,"tf":0.008547008547008548},"9":{"ref":9,"tf":0.012195121951219513},"12":{"ref":12,"tf":0.015151515151515152},"18":{"ref":18,"tf":0.016853932584269662},"21":{"ref":21,"tf":0.015384615384615385}}},"docs":{}}},"4":{"5":{"docs":{"8":{"ref":8,"tf":0.018518518518518517}}},"docs":{"3":{"ref":3,"tf":0.01764705882352941},"7":{"ref":7,"tf":0.044444444444444446},"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.022988505747126436},"14":{"ref":14,"tf":0.020833333333333332},"15":{"ref":15,"tf":0.006097560975609756},"20":{"ref":20,"tf":0.018518518518518517},"25":{"ref":25,"tf":0.00847457627118644}}},"5":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"5":{"ref":5,"tf":0.008547008547008548},"9":{"ref":9,"tf":0.012195121951219513},"15":{"ref":15,"tf":0.006097560975609756},"18":{"ref":18,"tf":0.0056179775280898875},"20":{"ref":20,"tf":0.018518518518518517},"21":{"ref":21,"tf":0.007692307692307693}}},"6":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"5":{"ref":5,"tf":0.017094017094017096},"6":{"ref":6,"tf":0.008771929824561403},"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.011494252873563218},"15":{"ref":15,"tf":0.012195121951219513},"16":{"ref":16,"tf":0.013333333333333334},"18":{"ref":18,"tf":0.0056179775280898875},"19":{"ref":19,"tf":0.015873015873015872},"20":{"ref":20,"tf":0.009259259259259259},"25":{"ref":25,"tf":0.00847457627118644}}},"7":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}},"8":{"docs":{"4":{"ref":4,"tf":0.01639344262295082},"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.011494252873563218},"15":{"ref":15,"tf":0.012195121951219513},"16":{"ref":16,"tf":0.013333333333333334},"19":{"ref":19,"tf":0.015873015873015872}},"o":{"docs":{},"z":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"20":{"ref":20,"tf":0.009259259259259259}}}}},"9":{"docs":{"15":{"ref":15,"tf":0.006097560975609756},"16":{"ref":16,"tf":0.013333333333333334},"18":{"ref":18,"tf":0.0056179775280898875}}},"docs":{},"a":{"docs":{},"d":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}},"d":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"3":{"ref":3,"tf":0.0058823529411764705},"6":{"ref":6,"tf":0.008771929824561403},"9":{"ref":9,"tf":0.012195121951219513},"10":{"ref":10,"tf":0.04597701149425287},"12":{"ref":12,"tf":0.015151515151515152},"14":{"ref":14,"tf":0.041666666666666664},"16":{"ref":16,"tf":0.013333333333333334},"19":{"ref":19,"tf":0.015873015873015872},"20":{"ref":20,"tf":0.027777777777777776},"21":{"ref":21,"tf":0.03076923076923077},"25":{"ref":25,"tf":0.03389830508474576}},"i":{"docs":{},"t":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}}}},"m":{"docs":{},"i":{"docs":{},"s":{"docs":{},"h":{"docs":{"0":{"ref":0,"tf":3.3487179487179484}}}}},"e":{"docs":{},"r":{"docs":{},"i":{"docs":{},"c":{"docs":{},"a":{"docs":{},"n":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}}}}}}}},"n":{"docs":{},"d":{"docs":{},"/":{"docs":{},"o":{"docs":{},"r":{"docs":{"0":{"ref":0,"tf":0.015384615384615385}}}}}},"o":{"docs":{},"t":{"docs":{},"h":{"docs":{"14":{"ref":14,"tf":0.020833333333333332}}}}}},"l":{"docs":{},"o":{"docs":{},"n":{"docs":{},"g":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}}}},"l":{"docs":{},"o":{"docs":{},"w":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}},"s":{"docs":{},"p":{"docs":{},"i":{"docs":{},"c":{"docs":{"25":{"ref":25,"tf":0.01694915254237288}}}}}}}},"s":{"docs":{},"i":{"docs":{},"d":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}}},"p":{"docs":{},"a":{"docs":{},"r":{"docs":{},"a":{"docs":{},"g":{"docs":{},"u":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}}}}}}}},"v":{"docs":{},"o":{"docs":{},"c":{"docs":{},"a":{"docs":{},"d":{"docs":{},"o":{"docs":{"3":{"ref":3,"tf":0.011764705882352941}}}}}}}},"i":{"docs":{},"r":{"docs":{},"t":{"docs":{},"i":{"docs":{},"g":{"docs":{},"h":{"docs":{},"t":{"docs":{"5":{"ref":5,"tf":0.008547008547008548}}}}}}}}},"c":{"docs":{},"c":{"docs":{},"o":{"docs":{},"r":{"docs":{},"d":{"docs":{"6":{"ref":6,"tf":0.008771929824561403}}}},"m":{"docs":{},"p":{"docs":{},"a":{"docs":{},"n":{"docs":{},"i":{"docs":{"18":{"ref":18,"tf":0.016853932584269662}}}}}}}}},"t":{"docs":{},"i":{"docs":{},"v":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}}}},"b":{"docs":{},"o":{"docs":{},"v":{"docs":{"8":{"ref":8,"tf":0.018518518518518517},"18":{"ref":18,"tf":0.011235955056179775}}},"u":{"docs":{},"t":{"docs":{},".":{"docs":{},"c":{"docs":{},"o":{"docs":{},"m":{"docs":{},"]":{"docs":{},"(":{"docs":{},"h":{"docs":{},"t":{"docs":{},"t":{"docs":{},"p":{"docs":{},":":{"docs":{},"/":{"docs":{},"/":{"docs":{},"s":{"docs":{},"o":{"docs":{},"u":{"docs":{},"t":{"docs":{},"h":{"docs":{},"e":{"docs":{},"r":{"docs":{},"n":{"docs":{},"f":{"docs":{},"o":{"docs":{},"o":{"docs":{},"d":{"docs":{},".":{"docs":{},"a":{"docs":{},"b":{"docs":{},"o":{"docs":{},"u":{"docs":{},"t":{"docs":{},".":{"docs":{},"c":{"docs":{},"o":{"docs":{},"m":{"docs":{},"/":{"docs":{},"o":{"docs":{},"d":{"docs":{},"/":{"docs":{},"c":{"docs":{},"r":{"docs":{},"o":{"docs":{},"c":{"docs":{},"k":{"docs":{},"p":{"docs":{},"o":{"docs":{},"t":{"docs":{},"p":{"docs":{},"o":{"docs":{},"r":{"docs":{},"k":{"docs":{},"a":{"docs":{},"n":{"docs":{},"d":{"docs":{},"h":{"docs":{},"a":{"docs":{},"m":{"docs":{},"/":{"docs":{},"r":{"docs":{},"/":{"docs":{},"r":{"8":{"0":{"4":{"1":{"8":{"docs":{},"g":{"docs":{},".":{"docs":{},"h":{"docs":{},"t":{"docs":{},"m":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}}}}}}},"docs":{}},"docs":{}},"docs":{}},"docs":{}},"docs":{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}},"h":{"docs":{},"e":{"docs":{},"a":{"docs":{},"d":{"docs":{"8":{"ref":8,"tf":0.018518518518518517}}}}}},"p":{"docs":{},"p":{"docs":{},"l":{"docs":{"15":{"ref":15,"tf":0.024390243902439025},"25":{"ref":25,"tf":0.03389830508474576}}}}},"r":{"docs":{},"r":{"docs":{},"a":{"docs":{},"n":{"docs":{},"g":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}}}}}}},"b":{"docs":{},"a":{"docs":{},"k":{"docs":{},"e":{"docs":{"0":{"ref":0,"tf":3.379487179487179},"1":{"ref":1,"tf":0.04},"3":{"ref":3,"tf":0.0058823529411764705},"5":{"ref":5,"tf":0.008547008547008548},"6":{"ref":6,"tf":0.017543859649122806},"8":{"ref":8,"tf":0.018518518518518517},"9":{"ref":9,"tf":0.012195121951219513},"11":{"ref":11,"tf":0.03076923076923077},"18":{"ref":18,"tf":0.0056179775280898875},"24":{"ref":24,"tf":0.03125}}}},"n":{"docs":{},"a":{"docs":{},"n":{"docs":{},"a":{"docs":{"1":{"ref":1,"tf":3.3866666666666663},"17":{"ref":17,"tf":0.03225806451612903}}}}}},"r":{"docs":{},"b":{"docs":{},"e":{"docs":{},"c":{"docs":{},"u":{"docs":{"2":{"ref":2,"tf":5.0256410256410255},"15":{"ref":15,"tf":0.024390243902439025}}}}}}},"s":{"docs":{},"t":{"docs":{"2":{"ref":2,"tf":0.05128205128205128}}},"i":{"docs":{},"l":{"docs":{"6":{"ref":6,"tf":0.008771929824561403}}}}},"l":{"docs":{},"l":{"docs":{"4":{"ref":4,"tf":5.049180327868853},"9":{"ref":9,"tf":0.006097560975609756},"13":{"ref":13,"tf":0.04}}}},"g":{"docs":{},"e":{"docs":{},"l":{"docs":{"5":{"ref":5,"tf":0.008547008547008548}}}}},"t":{"docs":{},"t":{"docs":{},"e":{"docs":{},"r":{"docs":{"11":{"ref":11,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}}}}},"o":{"docs":{},"w":{"docs":{},"l":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"3":{"ref":3,"tf":0.011764705882352941},"5":{"ref":5,"tf":0.008547008547008548},"7":{"ref":7,"tf":0.022222222222222223},"9":{"ref":9,"tf":0.012195121951219513},"11":{"ref":11,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}},"i":{"docs":{},"l":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"12":{"ref":12,"tf":0.015151515151515152},"14":{"ref":14,"tf":0.020833333333333332},"20":{"ref":20,"tf":0.009259259259259259},"21":{"ref":21,"tf":0.015384615384615385}}}},"n":{"docs":{},"e":{"docs":{},"l":{"docs":{},"e":{"docs":{},"s":{"docs":{},"s":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"15":{"ref":15,"tf":0.012195121951219513},"20":{"ref":20,"tf":0.009259259259259259},"21":{"ref":21,"tf":0.007692307692307693}}}}}}}},"t":{"docs":{},"t":{"docs":{},"o":{"docs":{},"m":{"docs":{"14":{"ref":14,"tf":0.020833333333333332},"15":{"ref":15,"tf":0.006097560975609756}}}},"l":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}}}},"x":{"docs":{"23":{"ref":23,"tf":0.029411764705882353}}}},"r":{"docs":{},"o":{"docs":{},"w":{"docs":{},"n":{"docs":{"0":{"ref":0,"tf":0.03076923076923077},"3":{"ref":3,"tf":0.0058823529411764705},"9":{"ref":9,"tf":0.006097560975609756},"12":{"ref":12,"tf":0.030303030303030304},"15":{"ref":15,"tf":0.018292682926829267},"16":{"ref":16,"tf":0.013333333333333334},"19":{"ref":19,"tf":0.015873015873015872}}}},"t":{"docs":{},"h":{"docs":{"14":{"ref":14,"tf":0.041666666666666664},"20":{"ref":20,"tf":0.018518518518518517}}}},"c":{"docs":{},"c":{"docs":{},"o":{"docs":{},"l":{"docs":{},"i":{"docs":{"20":{"ref":20,"tf":0.018518518518518517}}}}}}},"k":{"docs":{},"e":{"docs":{},"n":{"docs":{"20":{"ref":20,"tf":0.009259259259259259}}}}}},"i":{"docs":{},"n":{"docs":{},"g":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"12":{"ref":12,"tf":0.015151515151515152},"14":{"ref":14,"tf":0.020833333333333332},"20":{"ref":20,"tf":0.009259259259259259}}}}},"e":{"docs":{},"a":{"docs":{},"s":{"docs":{},"t":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"20":{"ref":20,"tf":0.009259259259259259},"21":{"ref":21,"tf":0.007692307692307693}}}}}},"u":{"docs":{},"s":{"docs":{},"h":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}}},"a":{"docs":{},"n":{"docs":{},"d":{"docs":{},"i":{"docs":{"25":{"ref":25,"tf":0.01694915254237288}}}}}}},"u":{"docs":{},"t":{"docs":{},"t":{"docs":{},"e":{"docs":{},"r":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"5":{"ref":5,"tf":0.02564102564102564},"8":{"ref":8,"tf":0.037037037037037035},"9":{"ref":9,"tf":0.024390243902439025},"13":{"ref":13,"tf":0.1},"18":{"ref":18,"tf":0.02247191011235955},"20":{"ref":20,"tf":0.018518518518518517}},"/":{"docs":{},"m":{"docs":{},"a":{"docs":{},"r":{"docs":{},"g":{"docs":{"0":{"ref":0,"tf":0.015384615384615385}}}}}}},"n":{"docs":{},"u":{"docs":{},"t":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}}}}}}},"r":{"docs":{},"r":{"docs":{},"i":{"docs":{},"t":{"docs":{},"o":{"docs":{"3":{"ref":3,"tf":3.356862745098039},"18":{"ref":18,"tf":0.0056179775280898875}}}}}}},"c":{"docs":{},"k":{"docs":{},"e":{"docs":{},"y":{"docs":{"13":{"ref":13,"tf":3.353333333333333}}}}}}},"e":{"docs":{},"a":{"docs":{},"t":{"docs":{"1":{"ref":1,"tf":0.013333333333333334},"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.034482758620689655},"11":{"ref":11,"tf":0.015384615384615385},"14":{"ref":14,"tf":0.020833333333333332},"24":{"ref":24,"tf":0.015625}},"e":{"docs":{},"n":{"docs":{"11":{"ref":11,"tf":0.015384615384615385},"14":{"ref":14,"tf":0.020833333333333332},"24":{"ref":24,"tf":0.015625}}}}},"n":{"docs":{"3":{"ref":3,"tf":3.3686274509803917},"16":{"ref":16,"tf":0.02666666666666667},"19":{"ref":19,"tf":0.015873015873015872},"21":{"ref":21,"tf":0.023076923076923078}}}},"l":{"docs":{},"l":{"docs":{"6":{"ref":6,"tf":0.008771929824561403}}}},"e":{"docs":{},"f":{"docs":{"16":{"ref":16,"tf":0.02666666666666667},"19":{"ref":19,"tf":0.031746031746031744}}}},"n":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}},"l":{"docs":{},"a":{"docs":{},"c":{"docs":{},"k":{"docs":{"3":{"ref":3,"tf":3.345098039215686},"15":{"ref":15,"tf":0.006097560975609756},"19":{"ref":19,"tf":0.015873015873015872},"22":{"ref":22,"tf":0.05}}}}},"e":{"docs":{},"n":{"docs":{},"d":{"docs":{"4":{"ref":4,"tf":0.01639344262295082},"18":{"ref":18,"tf":0.011235955056179775}}}}}},"i":{"docs":{},"t":{"docs":{},"e":{"docs":{"5":{"ref":5,"tf":0.008547008547008548}}}},"s":{"docs":{},"c":{"docs":{},"u":{"docs":{},"i":{"docs":{},"t":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}}}}}}}},"c":{"docs":{},"o":{"docs":{},"m":{"docs":{},"b":{"docs":{},"i":{"docs":{},"n":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"1":{"ref":1,"tf":0.013333333333333334},"2":{"ref":2,"tf":0.02564102564102564},"3":{"ref":3,"tf":0.0058823529411764705},"4":{"ref":4,"tf":0.01639344262295082},"12":{"ref":12,"tf":0.015151515151515152},"16":{"ref":16,"tf":0.013333333333333334},"18":{"ref":18,"tf":0.0056179775280898875}}}}}},"o":{"docs":{},"k":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"3":{"ref":3,"tf":0.01764705882352941},"6":{"ref":6,"tf":0.017543859649122806},"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.011494252873563218},"12":{"ref":12,"tf":0.030303030303030304},"15":{"ref":15,"tf":2.024390243902439},"18":{"ref":18,"tf":0.028089887640449437},"20":{"ref":20,"tf":0.018518518518518517},"21":{"ref":21,"tf":0.023076923076923078},"22":{"ref":22,"tf":0.05},"23":{"ref":23,"tf":0.029411764705882353},"25":{"ref":25,"tf":0.00847457627118644}},"i":{"docs":{"8":{"ref":8,"tf":0.018518518518518517}}},"b":{"docs":{},"o":{"docs":{},"o":{"docs":{},"k":{"docs":{"12":{"ref":12,"tf":0.015151515151515152}}}}}},"e":{"docs":{},"r":{"docs":{"15":{"ref":15,"tf":0.018292682926829267},"16":{"ref":16,"tf":3.3466666666666662}}}}},"l":{"docs":{"5":{"ref":5,"tf":0.008547008547008548},"10":{"ref":10,"tf":0.011494252873563218},"12":{"ref":12,"tf":0.015151515151515152}}}},"a":{"docs":{},"r":{"docs":{},"s":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}}},"t":{"docs":{"5":{"ref":5,"tf":0.017094017094017096},"10":{"ref":10,"tf":0.011494252873563218},"15":{"ref":15,"tf":0.006097560975609756}}}},"n":{"docs":{},"t":{"docs":{},"a":{"docs":{},"i":{"docs":{},"n":{"docs":{"5":{"ref":5,"tf":0.008547008547008548}}}}}},"s":{"docs":{},"t":{"docs":{},"a":{"docs":{},"n":{"docs":{},"t":{"docs":{},"l":{"docs":{},"i":{"docs":{"10":{"ref":10,"tf":0.011494252873563218},"21":{"ref":21,"tf":0.007692307692307693}}}}}}}}},"f":{"docs":{},"e":{"docs":{},"c":{"docs":{},"t":{"docs":{},"i":{"docs":{},"o":{"docs":{},"n":{"docs":{},"e":{"docs":{},"r":{"docs":{},"'":{"docs":{"13":{"ref":13,"tf":0.04}}}}}}}}}}}},"d":{"docs":{},"e":{"docs":{},"n":{"docs":{},"s":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}}}}}},"r":{"docs":{},"n":{"docs":{"5":{"ref":5,"tf":0.008547008547008548},"8":{"ref":8,"tf":3.3703703703703702},"19":{"ref":19,"tf":0.015873015873015872}}}},"l":{"docs":{},"e":{"docs":{"7":{"ref":7,"tf":5.022222222222222}}}},"v":{"docs":{},"e":{"docs":{},"r":{"docs":{"9":{"ref":9,"tf":0.012195121951219513},"12":{"ref":12,"tf":0.030303030303030304},"13":{"ref":13,"tf":0.02},"15":{"ref":15,"tf":0.012195121951219513},"16":{"ref":16,"tf":0.013333333333333334},"18":{"ref":18,"tf":0.011235955056179775},"20":{"ref":20,"tf":0.027777777777777776},"22":{"ref":22,"tf":0.05},"25":{"ref":25,"tf":0.00847457627118644}}}}},"u":{"docs":{},"n":{"docs":{},"t":{"docs":{},"r":{"docs":{},"i":{"docs":{"15":{"ref":15,"tf":2.018292682926829}}}}}},"p":{"docs":{},"l":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}},"c":{"docs":{},"o":{"docs":{},"n":{"docs":{},"u":{"docs":{},"t":{"docs":{"21":{"ref":21,"tf":0.03076923076923077}}}}}}}},"u":{"docs":{},"p":{"docs":{"0":{"ref":0,"tf":0.06153846153846154},"1":{"ref":1,"tf":0.09333333333333334},"2":{"ref":2,"tf":0.07692307692307693},"3":{"ref":3,"tf":0.01764705882352941},"4":{"ref":4,"tf":0.03278688524590164},"5":{"ref":5,"tf":0.05982905982905983},"6":{"ref":6,"tf":0.017543859649122806},"7":{"ref":7,"tf":0.044444444444444446},"8":{"ref":8,"tf":0.037037037037037035},"9":{"ref":9,"tf":0.04878048780487805},"10":{"ref":10,"tf":0.05747126436781609},"11":{"ref":11,"tf":0.06153846153846154},"12":{"ref":12,"tf":0.045454545454545456},"13":{"ref":13,"tf":0.02},"14":{"ref":14,"tf":0.020833333333333332},"15":{"ref":15,"tf":0.018292682926829267},"16":{"ref":16,"tf":0.02666666666666667},"17":{"ref":17,"tf":0.0967741935483871},"18":{"ref":18,"tf":0.0449438202247191},"20":{"ref":20,"tf":0.027777777777777776},"21":{"ref":21,"tf":0.007692307692307693},"23":{"ref":23,"tf":0.08823529411764706},"24":{"ref":24,"tf":0.0625},"25":{"ref":25,"tf":0.0423728813559322}}},"b":{"docs":{},"e":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"18":{"ref":18,"tf":0.0056179775280898875}}}},"t":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"16":{"ref":16,"tf":0.013333333333333334}}},"s":{"docs":{},"t":{"docs":{},"a":{"docs":{},"r":{"docs":{},"d":{"docs":{"10":{"ref":10,"tf":0.011494252873563218}}}}}}},"m":{"docs":{},"i":{"docs":{},"n":{"docs":{"16":{"ref":16,"tf":0.02666666666666667}}}}}},"h":{"docs":{},"i":{"docs":{},"p":{"docs":{"1":{"ref":1,"tf":3.373333333333333},"5":{"ref":5,"tf":0.008547008547008548}}},"c":{"docs":{},"k":{"docs":{},"e":{"docs":{},"n":{"docs":{"2":{"ref":2,"tf":5.076923076923077},"6":{"ref":6,"tf":5.06140350877193},"8":{"ref":8,"tf":3.407407407407407},"18":{"ref":18,"tf":0.011235955056179775},"20":{"ref":20,"tf":3.3796296296296293},"21":{"ref":21,"tf":3.356410256410256}}}}}},"l":{"docs":{},"l":{"docs":{"4":{"ref":4,"tf":0.03278688524590164},"10":{"ref":10,"tf":0.011494252873563218}}},"i":{"docs":{"16":{"ref":16,"tf":3.373333333333333}}}}},"o":{"docs":{},"c":{"docs":{},"o":{"docs":{},"l":{"docs":{"1":{"ref":1,"tf":0.02666666666666667},"13":{"ref":13,"tf":0.04}}}}},"p":{"docs":{"3":{"ref":3,"tf":0.029411764705882353},"4":{"ref":4,"tf":0.06557377049180328},"14":{"ref":14,"tf":0.020833333333333332},"16":{"ref":16,"tf":0.02666666666666667},"18":{"ref":18,"tf":0.011235955056179775},"19":{"ref":19,"tf":0.031746031746031744},"21":{"ref":21,"tf":0.007692307692307693}}},"o":{"docs":{},"s":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}},"e":{"docs":{},"e":{"docs":{},"s":{"docs":{"3":{"ref":3,"tf":0.01764705882352941},"4":{"ref":4,"tf":5.049180327868853},"6":{"ref":6,"tf":0.02631578947368421},"8":{"ref":8,"tf":0.018518518518518517},"18":{"ref":18,"tf":0.016853932584269662}}}},"d":{"docs":{},"d":{"docs":{},"a":{"docs":{},"r":{"docs":{"4":{"ref":4,"tf":0.01639344262295082},"18":{"ref":18,"tf":0.0056179775280898875}}}}}},"x":{"docs":{"5":{"ref":5,"tf":3.367521367521367}}}}},"a":{"docs":{},"n":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"16":{"ref":16,"tf":0.013333333333333334},"19":{"ref":19,"tf":0.047619047619047616},"23":{"ref":23,"tf":0.029411764705882353}},"o":{"docs":{},"l":{"docs":{},"a":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}}}},"d":{"docs":{},"i":{"docs":{"13":{"ref":13,"tf":3.353333333333333}}}}},"c":{"docs":{},"c":{"docs":{},"i":{"docs":{},"a":{"docs":{},"t":{"docs":{},"o":{"docs":{},"r":{"docs":{"6":{"ref":6,"tf":5.008771929824562}}}}}}}}},"b":{"docs":{},"b":{"docs":{},"a":{"docs":{},"g":{"docs":{"7":{"ref":7,"tf":0.06666666666666667}}}}}},"s":{"docs":{},"s":{"docs":{},"e":{"docs":{},"r":{"docs":{},"o":{"docs":{},"l":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}}}}}}},"r":{"docs":{},"r":{"docs":{},"o":{"docs":{},"t":{"docs":{"20":{"ref":20,"tf":0.018518518518518517}}}}},"e":{"docs":{},"f":{"docs":{},"u":{"docs":{},"l":{"docs":{},"l":{"docs":{},"i":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}}}}}},"t":{"docs":{},"a":{"docs":{},"l":{"docs":{},"i":{"docs":{},"n":{"docs":{},"a":{"docs":{"20":{"ref":20,"tf":0.009259259259259259}}}}}}}}},"e":{"docs":{},"n":{"docs":{},"t":{"docs":{},"e":{"docs":{},"r":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"6":{"ref":6,"tf":0.008771929824561403},"11":{"ref":11,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}}}},"l":{"docs":{},"e":{"docs":{},"r":{"docs":{},"i":{"docs":{"7":{"ref":7,"tf":0.044444444444444446},"18":{"ref":18,"tf":0.0056179775280898875},"23":{"ref":23,"tf":0.029411764705882353}}}}}}},"i":{"docs":{},"l":{"docs":{},"a":{"docs":{},"n":{"docs":{},"t":{"docs":{},"r":{"docs":{},"o":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"21":{"ref":21,"tf":0.015384615384615385}}}}}}}},"d":{"docs":{},"e":{"docs":{},"r":{"docs":{"25":{"ref":25,"tf":0.01694915254237288}}}}},"n":{"docs":{},"n":{"docs":{},"a":{"docs":{},"m":{"docs":{},"o":{"docs":{},"n":{"docs":{"25":{"ref":25,"tf":0.025423728813559324}}}}}}}}},"l":{"docs":{},"o":{"docs":{},"v":{"docs":{},"e":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"15":{"ref":15,"tf":0.006097560975609756},"16":{"ref":16,"tf":0.013333333333333334},"25":{"ref":25,"tf":0.025423728813559324}}}}}},"r":{"docs":{},"u":{"docs":{},"s":{"docs":{},"h":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"8":{"ref":8,"tf":0.018518518518518517},"21":{"ref":21,"tf":0.015384615384615385}}}}},"e":{"docs":{},"a":{"docs":{},"m":{"docs":{"4":{"ref":4,"tf":0.01639344262295082},"10":{"ref":10,"tf":0.022988505747126436},"18":{"ref":18,"tf":0.02247191011235955},"21":{"ref":21,"tf":0.007692307692307693}},"i":{"docs":{"13":{"ref":13,"tf":0.02}}}}},"o":{"docs":{},"l":{"docs":{"22":{"ref":22,"tf":0.05}}}}},"i":{"docs":{},"s":{"docs":{},"p":{"docs":{"11":{"ref":11,"tf":2.5153846153846153}}}}},"y":{"docs":{},"s":{"docs":{},"t":{"docs":{},"a":{"docs":{},"l":{"docs":{"12":{"ref":12,"tf":0.030303030303030304}}}}}}},"o":{"docs":{},"c":{"docs":{},"k":{"docs":{},"e":{"docs":{},"r":{"docs":{},"i":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}}}},"p":{"docs":{},"o":{"docs":{},"t":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}}}}}},"y":{"docs":{},"a":{"docs":{},"n":{"docs":{"22":{"ref":22,"tf":0.05}}}}}},"d":{"docs":{},"i":{"docs":{},"s":{"docs":{},"h":{"docs":{"6":{"ref":6,"tf":0.008771929824561403}},"/":{"docs":{},"p":{"docs":{},"a":{"docs":{},"n":{"docs":{"0":{"ref":0,"tf":0.015384615384615385}}}}}}},"s":{"docs":{},"o":{"docs":{},"l":{"docs":{},"v":{"docs":{"9":{"ref":9,"tf":0.006097560975609756},"25":{"ref":25,"tf":0.00847457627118644}}}}}},"t":{"docs":{},"r":{"docs":{},"i":{"docs":{},"b":{"docs":{},"u":{"docs":{},"t":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}}}}}}}},"r":{"docs":{},"e":{"docs":{},"c":{"docs":{},"t":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"21":{"ref":21,"tf":0.007692307692307693}}}}}},"p":{"docs":{"8":{"ref":8,"tf":0.018518518518518517},"13":{"ref":13,"tf":0.04}}},"n":{"docs":{},"n":{"docs":{},"e":{"docs":{},"r":{"docs":{"9":{"ref":9,"tf":5.0060975609756095}}}}}},"v":{"docs":{},"i":{"docs":{},"d":{"docs":{"9":{"ref":9,"tf":0.018292682926829267},"20":{"ref":20,"tf":0.009259259259259259}}}}},"c":{"docs":{},"e":{"docs":{"18":{"ref":18,"tf":0.011235955056179775},"25":{"ref":25,"tf":0.01694915254237288}}}}},"r":{"docs":{},"i":{"docs":{"1":{"ref":1,"tf":0.013333333333333334},"6":{"ref":6,"tf":0.008771929824561403},"8":{"ref":8,"tf":0.018518518518518517},"9":{"ref":9,"tf":0.006097560975609756},"15":{"ref":15,"tf":0.006097560975609756},"17":{"ref":17,"tf":0.03225806451612903},"21":{"ref":21,"tf":0.007692307692307693}}},"a":{"docs":{},"i":{"docs":{},"n":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"15":{"ref":15,"tf":0.006097560975609756},"18":{"ref":18,"tf":0.0056179775280898875},"19":{"ref":19,"tf":0.015873015873015872},"21":{"ref":21,"tf":0.007692307692307693}}}}},"e":{"docs":{},"s":{"docs":{},"s":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"19":{"ref":19,"tf":0.031746031746031744},"20":{"ref":20,"tf":0.027777777777777776}}}}}},"o":{"docs":{},"n":{"docs":{},"e":{"docs":{"2":{"ref":2,"tf":0.02564102564102564}}}},"u":{"docs":{},"b":{"docs":{},"l":{"docs":{"9":{"ref":9,"tf":0.012195121951219513}}}},"g":{"docs":{},"h":{"docs":{"9":{"ref":9,"tf":0.012195121951219513}}}}},"w":{"docs":{},"n":{"docs":{"9":{"ref":9,"tf":0.006097560975609756},"12":{"ref":12,"tf":0.015151515151515152}}}},"z":{"docs":{},"e":{"docs":{},"n":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}}},"t":{"docs":{"10":{"ref":10,"tf":0.011494252873563218}}}},"a":{"docs":{},"i":{"docs":{},"r":{"docs":{},"i":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}}}},"s":{"docs":{},"h":{"docs":{"4":{"ref":4,"tf":0.03278688524590164},"10":{"ref":10,"tf":0.011494252873563218}}}},"k":{"docs":{},"o":{"docs":{},"t":{"docs":{},"a":{"docs":{"12":{"ref":12,"tf":0.015151515151515152}}}}}}}},"e":{"docs":{},"d":{"docs":{},"g":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"3":{"ref":3,"tf":0.0058823529411764705}},"i":{"docs":{},"n":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"7":{"ref":7,"tf":0.022222222222222223},"23":{"ref":23,"tf":0.029411764705882353}}}}}},"g":{"docs":{},"g":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"1":{"ref":1,"tf":0.02666666666666667},"6":{"ref":6,"tf":0.008771929824561403},"10":{"ref":10,"tf":0.04597701149425287},"11":{"ref":11,"tf":0.046153846153846156},"14":{"ref":14,"tf":3.4166666666666665},"24":{"ref":24,"tf":0.0625}},"n":{"docs":{},"o":{"docs":{},"g":{"docs":{"10":{"ref":10,"tf":10.011494252873563}}}}}}},"v":{"docs":{},"e":{"docs":{},"n":{"docs":{},"l":{"docs":{},"i":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"5":{"ref":5,"tf":0.017094017094017096},"15":{"ref":15,"tf":0.006097560975609756}}}}}}},"a":{"docs":{},"c":{"docs":{},"h":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"3":{"ref":3,"tf":0.0058823529411764705},"9":{"ref":9,"tf":0.006097560975609756},"25":{"ref":25,"tf":0.00847457627118644}}}}},"x":{"docs":{},"c":{"docs":{},"e":{"docs":{},"p":{"docs":{},"t":{"docs":{"4":{"ref":4,"tf":0.01639344262295082},"6":{"ref":6,"tf":0.008771929824561403},"11":{"ref":11,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}},"s":{"docs":{},"s":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}}}}},"p":{"docs":{},"o":{"docs":{},"s":{"docs":{"13":{"ref":13,"tf":0.02}}}}},"t":{"docs":{},"r":{"docs":{},"a":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}}}}},"l":{"docs":{},"a":{"docs":{},"s":{"docs":{},"t":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}}},"s":{"docs":{},"i":{"docs":{"12":{"ref":12,"tf":0.015151515151515152}}}}},"n":{"docs":{},"o":{"docs":{},"u":{"docs":{},"g":{"docs":{},"h":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}}}}},"p":{"docs":{},"p":{"docs":{"12":{"ref":12,"tf":0.015151515151515152}}}},"h":{"docs":{},"m":{"docs":{},"k":{"docs":{"19":{"ref":19,"tf":0.015873015873015872},"25":{"ref":25,"tf":0.00847457627118644}}}}},"m":{"docs":{},"i":{"docs":{},"l":{"docs":{},"i":{"docs":{"19":{"ref":19,"tf":0.015873015873015872}}}}}}},"f":{"docs":{},"r":{"docs":{},"u":{"docs":{},"i":{"docs":{},"t":{"docs":{"0":{"ref":0,"tf":0.015384615384615385}}}}},"e":{"docs":{},"s":{"docs":{},"h":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"6":{"ref":6,"tf":0.008771929824561403},"18":{"ref":18,"tf":0.0056179775280898875},"21":{"ref":21,"tf":0.015384615384615385}}}}}},"i":{"docs":{},"l":{"docs":{},"l":{"docs":{"1":{"ref":1,"tf":0.013333333333333334}}}},"n":{"docs":{},"e":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"4":{"ref":4,"tf":0.03278688524590164},"16":{"ref":16,"tf":0.013333333333333334}}},"i":{"docs":{},"s":{"docs":{},"h":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}}}},"a":{"docs":{},"l":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}},"r":{"docs":{},"m":{"docs":{"14":{"ref":14,"tf":0.020833333333333332}}}}},"l":{"docs":{},"o":{"docs":{},"u":{"docs":{},"r":{"docs":{"1":{"ref":1,"tf":0.013333333333333334},"9":{"ref":9,"tf":0.024390243902439025},"11":{"ref":11,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}},"r":{"docs":{},"e":{"docs":{},"t":{"docs":{"20":{"ref":20,"tf":0.009259259259259259}}}}},"a":{"docs":{},"t":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}},"a":{"docs":{},"v":{"docs":{},"o":{"docs":{},"r":{"docs":{"5":{"ref":5,"tf":0.008547008547008548},"12":{"ref":12,"tf":0.030303030303030304},"15":{"ref":15,"tf":0.006097560975609756}}}}},"k":{"docs":{},"e":{"docs":{"8":{"ref":8,"tf":3.3703703703703702}}}}}},"u":{"docs":{},"l":{"docs":{},"l":{"docs":{"1":{"ref":1,"tf":0.013333333333333334}}}}},"o":{"docs":{},"l":{"docs":{},"d":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"11":{"ref":11,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}},"o":{"docs":{},"d":{"docs":{},"s":{"docs":{},"]":{"docs":{},"(":{"docs":{},"h":{"docs":{},"t":{"docs":{},"t":{"docs":{},"p":{"docs":{},":":{"docs":{},"/":{"docs":{},"/":{"docs":{},"w":{"docs":{},"w":{"docs":{},"w":{"docs":{},".":{"docs":{},"w":{"docs":{},"h":{"docs":{},"o":{"docs":{},"l":{"docs":{},"e":{"docs":{},"f":{"docs":{},"o":{"docs":{},"o":{"docs":{},"d":{"docs":{},"s":{"docs":{},"m":{"docs":{},"a":{"docs":{},"r":{"docs":{},"k":{"docs":{},"e":{"docs":{},"t":{"docs":{},".":{"docs":{},"c":{"docs":{},"o":{"docs":{},"m":{"docs":{},"/":{"docs":{},"r":{"docs":{},"e":{"docs":{},"c":{"docs":{},"i":{"docs":{},"p":{"docs":{},"e":{"docs":{},"s":{"docs":{},"/":{"1":{"6":{"9":{"9":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}},"docs":{}},"docs":{}},"docs":{}},"docs":{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}},"r":{"docs":{},"m":{"docs":{"9":{"ref":9,"tf":0.006097560975609756},"13":{"ref":13,"tf":0.02}}}},"a":{"docs":{},"m":{"docs":{},"i":{"docs":{"10":{"ref":10,"tf":0.011494252873563218}}}}}},"e":{"docs":{},"w":{"docs":{"12":{"ref":12,"tf":0.015151515151515152}}}},"a":{"docs":{},"t":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}},"v":{"docs":{},"o":{"docs":{},"r":{"docs":{},"i":{"docs":{},"t":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}}}}}}}},"g":{"docs":{},"o":{"docs":{},"l":{"docs":{},"d":{"docs":{},"e":{"docs":{},"n":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"9":{"ref":9,"tf":0.006097560975609756}}}}}}},"r":{"docs":{},"e":{"docs":{},"a":{"docs":{},"s":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"1":{"ref":1,"tf":0.013333333333333334},"9":{"ref":9,"tf":0.018292682926829267},"15":{"ref":15,"tf":0.006097560975609756}}},"t":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}}},"e":{"docs":{},"n":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"6":{"ref":6,"tf":0.017543859649122806},"14":{"ref":14,"tf":0.020833333333333332},"16":{"ref":16,"tf":0.02666666666666667},"18":{"ref":18,"tf":0.016853932584269662},"21":{"ref":21,"tf":0.015384615384615385},"23":{"ref":23,"tf":0.029411764705882353}}}}},"a":{"docs":{},"m":{"docs":{},"m":{"docs":{},"i":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"7":{"ref":7,"tf":0.022222222222222223},"23":{"ref":23,"tf":0.029411764705882353}}}},"p":{"docs":{},"i":{"docs":{"2":{"ref":2,"tf":0.02564102564102564}}}}},"t":{"docs":{},"e":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"7":{"ref":7,"tf":0.044444444444444446},"8":{"ref":8,"tf":0.018518518518518517}},"d":{"docs":{},",":{"docs":{},"p":{"docs":{},"e":{"docs":{},"e":{"docs":{},"l":{"docs":{"21":{"ref":21,"tf":0.007692307692307693}}}}}}}}}},"d":{"docs":{},"u":{"docs":{},"a":{"docs":{},"l":{"docs":{"5":{"ref":5,"tf":0.017094017094017096},"10":{"ref":10,"tf":0.011494252873563218}}}}}}},"o":{"docs":{},"u":{"docs":{},"n":{"docs":{},"d":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"10":{"ref":10,"tf":0.011494252873563218},"15":{"ref":15,"tf":0.006097560975609756},"16":{"ref":16,"tf":0.02666666666666667},"19":{"ref":19,"tf":0.015873015873015872},"25":{"ref":25,"tf":0.00847457627118644}}}}}},"i":{"docs":{},"d":{"docs":{"11":{"ref":11,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}}},"a":{"docs":{},"r":{"docs":{},"l":{"docs":{},"i":{"docs":{},"c":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"5":{"ref":5,"tf":0.017094017094017096},"6":{"ref":6,"tf":0.008771929824561403},"8":{"ref":8,"tf":0.018518518518518517},"15":{"ref":15,"tf":0.024390243902439025},"16":{"ref":16,"tf":0.02666666666666667},"21":{"ref":21,"tf":0.015384615384615385}}}}}},"l":{"docs":{},"l":{"docs":{},"o":{"docs":{},"n":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}}}},"e":{"docs":{},"r":{"docs":{},"m":{"docs":{"9":{"ref":9,"tf":0.012195121951219513}}}}},"i":{"docs":{},"n":{"docs":{},"g":{"docs":{},"e":{"docs":{},"r":{"docs":{"21":{"ref":21,"tf":0.023076923076923078},"25":{"ref":25,"tf":0.01694915254237288}}}}}}},"l":{"docs":{},"o":{"docs":{},"v":{"docs":{},"e":{"docs":{"21":{"ref":21,"tf":0.007692307692307693}}}}}}},"i":{"docs":{},"n":{"docs":{},"g":{"docs":{},"r":{"docs":{},"e":{"docs":{},"d":{"docs":{},"i":{"docs":{"0":{"ref":0,"tf":0.03076923076923077},"1":{"ref":1,"tf":0.02666666666666667},"2":{"ref":2,"tf":0.05128205128205128},"3":{"ref":3,"tf":0.0058823529411764705},"4":{"ref":4,"tf":0.03278688524590164},"5":{"ref":5,"tf":0.02564102564102564},"6":{"ref":6,"tf":0.017543859649122806},"7":{"ref":7,"tf":0.022222222222222223},"8":{"ref":8,"tf":0.037037037037037035},"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.011494252873563218},"11":{"ref":11,"tf":0.03076923076923077},"12":{"ref":12,"tf":0.015151515151515152},"13":{"ref":13,"tf":0.02},"14":{"ref":14,"tf":0.020833333333333332},"15":{"ref":15,"tf":0.006097560975609756},"16":{"ref":16,"tf":0.013333333333333334},"17":{"ref":17,"tf":0.03225806451612903},"18":{"ref":18,"tf":0.011235955056179775},"19":{"ref":19,"tf":0.015873015873015872},"20":{"ref":20,"tf":0.009259259259259259},"21":{"ref":21,"tf":0.007692307692307693},"22":{"ref":22,"tf":0.1},"23":{"ref":23,"tf":0.029411764705882353},"24":{"ref":24,"tf":0.03125},"25":{"ref":25,"tf":0.00847457627118644}}}}}}},"c":{"docs":{},"h":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"18":{"ref":18,"tf":0.0056179775280898875}}},"r":{"docs":{},"e":{"docs":{},"a":{"docs":{},"s":{"docs":{"11":{"ref":11,"tf":0.015384615384615385}}}}}}},"s":{"docs":{},"e":{"docs":{},"r":{"docs":{},"t":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}}}},"t":{"docs":{},"a":{"docs":{},"n":{"docs":{},"t":{"docs":{"17":{"ref":17,"tf":0.03225806451612903}}}}}}}},"m":{"docs":{},"m":{"docs":{},"e":{"docs":{},"d":{"docs":{},"i":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"20":{"ref":20,"tf":0.009259259259259259}}}}}}},"t":{"docs":{},"a":{"docs":{},"l":{"docs":{},"i":{"docs":{},"a":{"docs":{},"n":{"docs":{"6":{"ref":6,"tf":0.008771929824561403}}}}}}}},"s":{"docs":{},"l":{"docs":{},"a":{"docs":{},"n":{"docs":{},"d":{"docs":{"10":{"ref":10,"tf":0.011494252873563218}}}}}}}},"m":{"docs":{},"e":{"docs":{},"l":{"docs":{},"t":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"3":{"ref":3,"tf":0.0058823529411764705},"5":{"ref":5,"tf":0.017094017094017096},"8":{"ref":8,"tf":0.037037037037037035},"9":{"ref":9,"tf":0.006097560975609756},"12":{"ref":12,"tf":0.015151515151515152},"13":{"ref":13,"tf":0.02}}}},"d":{"docs":{"20":{"ref":20,"tf":0.009259259259259259},"21":{"ref":21,"tf":0.007692307692307693}},"i":{"docs":{},"u":{"docs":{},"m":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"10":{"ref":10,"tf":0.011494252873563218},"11":{"ref":11,"tf":0.015384615384615385},"18":{"ref":18,"tf":0.0056179775280898875},"20":{"ref":20,"tf":0.009259259259259259},"24":{"ref":24,"tf":0.015625}}}}}},"a":{"docs":{},"t":{"docs":{"15":{"ref":15,"tf":0.006097560975609756},"18":{"ref":18,"tf":0.016853932584269662}},"i":{"docs":{"8":{"ref":8,"tf":0.018518518518518517}}}}}},"i":{"docs":{},"l":{"docs":{},"k":{"docs":{"0":{"ref":0,"tf":0.03076923076923077},"9":{"ref":9,"tf":0.012195121951219513},"10":{"ref":10,"tf":0.022988505747126436},"11":{"ref":11,"tf":0.015384615384615385},"17":{"ref":17,"tf":0.03225806451612903},"18":{"ref":18,"tf":0.016853932584269662},"21":{"ref":21,"tf":0.023076923076923078},"24":{"ref":24,"tf":0.015625}}}},"n":{"docs":{"24":{"ref":24,"tf":0.015625}},"u":{"docs":{},"t":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"1":{"ref":1,"tf":0.013333333333333334},"3":{"ref":3,"tf":0.0058823529411764705},"5":{"ref":5,"tf":0.02564102564102564},"6":{"ref":6,"tf":0.017543859649122806},"8":{"ref":8,"tf":0.018518518518518517},"9":{"ref":9,"tf":0.024390243902439025},"10":{"ref":10,"tf":0.011494252873563218},"11":{"ref":11,"tf":0.015384615384615385},"12":{"ref":12,"tf":0.030303030303030304},"18":{"ref":18,"tf":0.016853932584269662},"19":{"ref":19,"tf":0.015873015873015872},"20":{"ref":20,"tf":0.027777777777777776},"21":{"ref":21,"tf":0.015384615384615385},"25":{"ref":25,"tf":0.00847457627118644}}}},"i":{"docs":{"1":{"ref":1,"tf":0.013333333333333334}}},"c":{"docs":{"15":{"ref":15,"tf":0.012195121951219513},"21":{"ref":21,"tf":0.007692307692307693}}}},"x":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"3":{"ref":3,"tf":0.0058823529411764705},"4":{"ref":4,"tf":0.01639344262295082},"5":{"ref":5,"tf":3.35042735042735},"6":{"ref":6,"tf":0.008771929824561403},"7":{"ref":7,"tf":0.022222222222222223},"8":{"ref":8,"tf":0.018518518518518517},"9":{"ref":9,"tf":0.012195121951219513},"10":{"ref":10,"tf":0.011494252873563218},"11":{"ref":11,"tf":0.015384615384615385},"13":{"ref":13,"tf":0.02},"19":{"ref":19,"tf":0.031746031746031744},"21":{"ref":21,"tf":0.007692307692307693},"24":{"ref":24,"tf":0.03125},"25":{"ref":25,"tf":0.00847457627118644}},"t":{"docs":{},"u":{"docs":{},"r":{"docs":{"1":{"ref":1,"tf":0.013333333333333334},"2":{"ref":2,"tf":0.02564102564102564},"3":{"ref":3,"tf":0.011764705882352941},"10":{"ref":10,"tf":0.011494252873563218},"13":{"ref":13,"tf":0.02}}}}},"e":{"docs":{},"r":{"docs":{"11":{"ref":11,"tf":0.015384615384615385}}}}},"c":{"docs":{},"r":{"docs":{},"o":{"docs":{},"w":{"docs":{},"a":{"docs":{},"v":{"docs":{"5":{"ref":5,"tf":0.02564102564102564},"18":{"ref":18,"tf":0.02247191011235955}}}}}}}}},"o":{"docs":{},"m":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"1":{"ref":1,"tf":0.013333333333333334},"4":{"ref":4,"tf":0.01639344262295082},"5":{"ref":5,"tf":0.008547008547008548},"6":{"ref":6,"tf":0.008771929824561403},"8":{"ref":8,"tf":0.018518518518518517},"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.011494252873563218},"11":{"ref":11,"tf":0.015384615384615385},"13":{"ref":13,"tf":0.02},"14":{"ref":14,"tf":0.020833333333333332},"16":{"ref":16,"tf":0.013333333333333334},"17":{"ref":17,"tf":0.03225806451612903},"18":{"ref":18,"tf":0.0056179775280898875},"20":{"ref":20,"tf":0.009259259259259259},"21":{"ref":21,"tf":0.007692307692307693},"24":{"ref":24,"tf":0.015625}}},"i":{"docs":{},"s":{"docs":{},"t":{"docs":{},"e":{"docs":{},"n":{"docs":{"1":{"ref":1,"tf":0.013333333333333334},"11":{"ref":11,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}}}}},"n":{"docs":{},"t":{"docs":{},"e":{"docs":{},"r":{"docs":{},"e":{"docs":{},"y":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}}}}}}},"r":{"docs":{},"e":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"12":{"ref":12,"tf":0.015151515151515152},"18":{"ref":18,"tf":0.0056179775280898875}}}}},"a":{"docs":{},"s":{"docs":{},"h":{"docs":{"1":{"ref":1,"tf":0.013333333333333334},"3":{"ref":3,"tf":0.0058823529411764705},"9":{"ref":9,"tf":0.006097560975609756}}}},"r":{"docs":{},"g":{"docs":{},"a":{"docs":{},"r":{"docs":{},"i":{"docs":{},"n":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"5":{"ref":5,"tf":0.008547008547008548},"8":{"ref":8,"tf":0.018518518518518517},"9":{"ref":9,"tf":0.012195121951219513},"18":{"ref":18,"tf":0.0056179775280898875}}}}}}},"i":{"docs":{},"o":{"docs":{},"n":{"docs":{"12":{"ref":12,"tf":0.015151515151515152}}}}}},"y":{"docs":{},"o":{"docs":{},"n":{"docs":{},"n":{"docs":{},"a":{"docs":{},"i":{"docs":{},"s":{"docs":{"7":{"ref":7,"tf":0.044444444444444446},"23":{"ref":23,"tf":0.029411764705882353}}}}}}}}},"k":{"docs":{},"e":{"docs":{"15":{"ref":15,"tf":0.006097560975609756},"18":{"ref":18,"tf":0.0056179775280898875}},"r":{"docs":{"11":{"ref":11,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}}},"p":{"docs":{},"l":{"docs":{"12":{"ref":12,"tf":5.045454545454546}}}},"c":{"docs":{},"a":{"docs":{},"r":{"docs":{},"o":{"docs":{},"n":{"docs":{},"i":{"docs":{"23":{"ref":23,"tf":3.3627450980392153}}}}}}}}},"u":{"docs":{},"f":{"docs":{},"f":{"docs":{},"i":{"docs":{},"n":{"docs":{"1":{"ref":1,"tf":3.373333333333333}}}}}},"s":{"docs":{},"h":{"docs":{},"r":{"docs":{},"o":{"docs":{},"o":{"docs":{},"m":{"docs":{"6":{"ref":6,"tf":0.017543859649122806},"18":{"ref":18,"tf":0.0056179775280898875}}}}}}}},"e":{"docs":{},"n":{"docs":{},"s":{"docs":{},"t":{"docs":{},"e":{"docs":{},"r":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}}}}}}}}},"o":{"docs":{},"a":{"docs":{},"t":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"1":{"ref":1,"tf":0.013333333333333334}},"m":{"docs":{},"e":{"docs":{},"a":{"docs":{},"l":{"docs":{"0":{"ref":0,"tf":3.3487179487179484}}}}}}}},"i":{"docs":{},"l":{"docs":{"1":{"ref":1,"tf":0.02666666666666667},"3":{"ref":3,"tf":0.011764705882352941},"6":{"ref":6,"tf":0.017543859649122806},"11":{"ref":11,"tf":0.015384615384615385},"14":{"ref":14,"tf":0.020833333333333332},"21":{"ref":21,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}},"n":{"docs":{},"i":{"docs":{},"o":{"docs":{},"n":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"4":{"ref":4,"tf":0.01639344262295082},"5":{"ref":5,"tf":0.008547008547008548},"6":{"ref":6,"tf":0.02631578947368421},"14":{"ref":14,"tf":0.041666666666666664},"15":{"ref":15,"tf":0.018292682926829267},"16":{"ref":16,"tf":0.02666666666666667},"18":{"ref":18,"tf":0.016853932584269662},"19":{"ref":19,"tf":0.047619047619047616},"23":{"ref":23,"tf":0.029411764705882353}}}}},"c":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}},"t":{"docs":{},"o":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}}},"u":{"docs":{},"n":{"docs":{},"c":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"4":{"ref":4,"tf":0.01639344262295082},"15":{"ref":15,"tf":0.006097560975609756},"18":{"ref":18,"tf":0.0056179775280898875}}}}},"v":{"docs":{},"e":{"docs":{},"n":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"5":{"ref":5,"tf":0.02564102564102564}}},"r":{"docs":{"7":{"ref":7,"tf":0.022222222222222223},"10":{"ref":10,"tf":0.011494252873563218},"11":{"ref":11,"tf":0.015384615384615385},"15":{"ref":15,"tf":0.012195121951219513},"18":{"ref":18,"tf":0.011235955056179775},"21":{"ref":21,"tf":0.007692307692307693},"24":{"ref":24,"tf":0.015625}}}}},"h":{"docs":{},"i":{"docs":{},"o":{"docs":{"13":{"ref":13,"tf":3.353333333333333}}}}},"z":{"docs":{"13":{"ref":13,"tf":0.02},"23":{"ref":23,"tf":0.029411764705882353}}},"r":{"docs":{},"a":{"docs":{},"n":{"docs":{},"g":{"docs":{"17":{"ref":17,"tf":0.03225806451612903},"25":{"ref":25,"tf":0.01694915254237288}}}}}},"c":{"docs":{},"c":{"docs":{},"a":{"docs":{},"s":{"docs":{},"i":{"docs":{},"o":{"docs":{},"n":{"docs":{"18":{"ref":18,"tf":0.011235955056179775}}}}}}}}},"l":{"docs":{},"i":{"docs":{},"v":{"docs":{"21":{"ref":21,"tf":0.015384615384615385}}}}},"p":{"docs":{},"t":{"docs":{},"i":{"docs":{},"o":{"docs":{},"n":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}}}}},"p":{"docs":{},"o":{"docs":{},"w":{"docs":{},"d":{"docs":{},"e":{"docs":{},"r":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"1":{"ref":1,"tf":0.013333333333333334},"5":{"ref":5,"tf":0.017094017094017096},"8":{"ref":8,"tf":0.018518518518518517},"11":{"ref":11,"tf":0.015384615384615385},"16":{"ref":16,"tf":0.02666666666666667},"24":{"ref":24,"tf":0.015625}}}}}},"u":{"docs":{},"r":{"docs":{"7":{"ref":7,"tf":0.022222222222222223},"10":{"ref":10,"tf":0.011494252873563218},"11":{"ref":11,"tf":0.015384615384615385},"14":{"ref":14,"tf":0.020833333333333332},"15":{"ref":15,"tf":0.012195121951219513},"19":{"ref":19,"tf":0.015873015873015872},"24":{"ref":24,"tf":0.015625},"25":{"ref":25,"tf":0.00847457627118644}}},"n":{"docs":{},"d":{"docs":{"15":{"ref":15,"tf":0.006097560975609756},"19":{"ref":19,"tf":0.015873015873015872}}}}},"r":{"docs":{},"t":{"docs":{},"i":{"docs":{},"o":{"docs":{},"n":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}}}},"k":{"docs":{"15":{"ref":15,"tf":0.06097560975609756}}}},"t":{"docs":{"21":{"ref":21,"tf":0.015384615384615385},"25":{"ref":25,"tf":0.01694915254237288}},"a":{"docs":{},"t":{"docs":{},"o":{"docs":{"9":{"ref":9,"tf":0.012195121951219513},"18":{"ref":18,"tf":0.0056179775280898875}}}}}}},"r":{"docs":{},"e":{"docs":{},"p":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}},"a":{"docs":{},"r":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"1":{"ref":1,"tf":0.013333333333333334},"2":{"ref":2,"tf":0.02564102564102564},"3":{"ref":3,"tf":0.0058823529411764705},"4":{"ref":4,"tf":0.01639344262295082},"5":{"ref":5,"tf":0.008547008547008548},"6":{"ref":6,"tf":0.008771929824561403},"7":{"ref":7,"tf":0.022222222222222223},"8":{"ref":8,"tf":0.037037037037037035},"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.011494252873563218},"11":{"ref":11,"tf":0.015384615384615385},"12":{"ref":12,"tf":0.015151515151515152},"13":{"ref":13,"tf":0.02},"14":{"ref":14,"tf":0.020833333333333332},"15":{"ref":15,"tf":0.006097560975609756},"16":{"ref":16,"tf":0.013333333333333334},"18":{"ref":18,"tf":0.0056179775280898875},"19":{"ref":19,"tf":0.015873015873015872},"20":{"ref":20,"tf":0.009259259259259259},"21":{"ref":21,"tf":0.007692307692307693},"22":{"ref":22,"tf":0.05},"24":{"ref":24,"tf":0.015625},"25":{"ref":25,"tf":0.00847457627118644}}}}},"t":{"docs":{},"z":{"docs":{},"e":{"docs":{},"l":{"docs":{"5":{"ref":5,"tf":0.008547008547008548}}}}}},"h":{"docs":{},"e":{"docs":{},"a":{"docs":{},"t":{"docs":{"11":{"ref":11,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}}}},"v":{"docs":{},"e":{"docs":{},"n":{"docs":{},"t":{"docs":{"12":{"ref":12,"tf":0.015151515151515152}}}}}}},"i":{"docs":{},"o":{"docs":{},"r":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}}},"e":{"docs":{},"p":{"docs":{},"p":{"docs":{},"e":{"docs":{},"r":{"docs":{"3":{"ref":3,"tf":0.01764705882352941},"4":{"ref":4,"tf":0.01639344262295082},"6":{"ref":6,"tf":0.02631578947368421},"8":{"ref":8,"tf":0.018518518518518517},"15":{"ref":15,"tf":0.012195121951219513},"16":{"ref":16,"tf":0.05333333333333334},"18":{"ref":18,"tf":0.016853932584269662},"21":{"ref":21,"tf":0.015384615384615385},"22":{"ref":22,"tf":0.1},"23":{"ref":23,"tf":0.058823529411764705}}}}}},"a":{"docs":{},"k":{"docs":{"10":{"ref":10,"tf":0.011494252873563218}}},"n":{"docs":{},"u":{"docs":{},"t":{"docs":{"13":{"ref":13,"tf":0.06},"20":{"ref":20,"tf":3.3611111111111107}}}}}},"e":{"docs":{},"l":{"docs":{"17":{"ref":17,"tf":0.03225806451612903},"25":{"ref":25,"tf":0.00847457627118644}}}}},"i":{"docs":{},"n":{"docs":{},"e":{"docs":{},"a":{"docs":{},"p":{"docs":{},"p":{"docs":{},"l":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"18":{"ref":18,"tf":0.0056179775280898875},"25":{"ref":25,"tf":0.01694915254237288}}}}}}},"k":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"21":{"ref":21,"tf":0.007692307692307693}}},"t":{"docs":{},"o":{"docs":{"19":{"ref":19,"tf":0.015873015873015872}}}}},"m":{"docs":{},"e":{"docs":{},"n":{"docs":{},"t":{"docs":{},"o":{"docs":{"4":{"ref":4,"tf":0.01639344262295082},"18":{"ref":18,"tf":0.016853932584269662}}}}}}},"e":{"docs":{},"c":{"docs":{"8":{"ref":8,"tf":0.037037037037037035},"9":{"ref":9,"tf":0.006097560975609756},"15":{"ref":15,"tf":0.006097560975609756}}}}},"a":{"docs":{},"c":{"docs":{},"k":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}},"a":{"docs":{},"g":{"docs":{"4":{"ref":4,"tf":0.01639344262295082},"19":{"ref":19,"tf":0.031746031746031744}}}}}},"n":{"docs":{"5":{"ref":5,"tf":0.008547008547008548},"22":{"ref":22,"tf":0.05}}},"p":{"docs":{},"e":{"docs":{},"r":{"docs":{"5":{"ref":5,"tf":0.008547008547008548},"15":{"ref":15,"tf":0.006097560975609756}}}},"r":{"docs":{},"i":{"docs":{},"k":{"docs":{},"a":{"docs":{"22":{"ref":22,"tf":0.05}}}}}}},"r":{"docs":{},"t":{"docs":{},"i":{"docs":{"5":{"ref":5,"tf":3.3418803418803416}}}},"m":{"docs":{},"e":{"docs":{},"s":{"docs":{},"a":{"docs":{},"n":{"docs":{"6":{"ref":6,"tf":0.02631578947368421},"8":{"ref":8,"tf":0.018518518518518517}}}}}}}},"t":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}},"s":{"docs":{},"t":{"docs":{},"a":{"docs":{"21":{"ref":21,"tf":0.03076923076923077}}}}}},"k":{"docs":{},"g":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"21":{"ref":21,"tf":0.007692307692307693}}}},"l":{"docs":{},"a":{"docs":{},"c":{"docs":{},"e":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"9":{"ref":9,"tf":0.018292682926829267},"15":{"ref":15,"tf":0.006097560975609756},"25":{"ref":25,"tf":0.00847457627118644}}}},"i":{"docs":{},"n":{"docs":{"17":{"ref":17,"tf":0.03225806451612903}}}},"t":{"docs":{},"t":{"docs":{},"e":{"docs":{},"r":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}}}}}},"e":{"docs":{},"n":{"docs":{},"t":{"docs":{},"i":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}}}},"u":{"docs":{},"n":{"docs":{},"c":{"docs":{},"h":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}}},"t":{"docs":{"11":{"ref":11,"tf":0.015384615384615385},"15":{"ref":15,"tf":0.006097560975609756},"22":{"ref":22,"tf":0.05},"24":{"ref":24,"tf":0.015625}}},"f":{"docs":{},"f":{"docs":{"14":{"ref":14,"tf":3.3541666666666665}}}},"r":{"docs":{},"c":{"docs":{},"h":{"docs":{},"a":{"docs":{},"s":{"docs":{},"e":{"docs":{},"d":{"docs":{},"b":{"docs":{},"a":{"docs":{},"r":{"docs":{},"b":{"docs":{},"e":{"docs":{},"c":{"docs":{},"u":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}}}}}}}}}}}}}}}}},"q":{"docs":{},"u":{"docs":{},"i":{"docs":{},"c":{"docs":{},"k":{"docs":{"0":{"ref":0,"tf":0.015384615384615385}}}}},"a":{"docs":{},"r":{"docs":{},"t":{"docs":{"15":{"ref":15,"tf":0.006097560975609756},"18":{"ref":18,"tf":0.0056179775280898875}}}}}}},"s":{"docs":{},"a":{"docs":{},"l":{"docs":{},"t":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"1":{"ref":1,"tf":0.013333333333333334},"2":{"ref":2,"tf":0.02564102564102564},"3":{"ref":3,"tf":0.01764705882352941},"4":{"ref":4,"tf":0.01639344262295082},"5":{"ref":5,"tf":0.008547008547008548},"6":{"ref":6,"tf":0.008771929824561403},"7":{"ref":7,"tf":0.044444444444444446},"8":{"ref":8,"tf":0.018518518518518517},"9":{"ref":9,"tf":0.012195121951219513},"10":{"ref":10,"tf":0.022988505747126436},"11":{"ref":11,"tf":0.015384615384615385},"14":{"ref":14,"tf":0.041666666666666664},"15":{"ref":15,"tf":0.012195121951219513},"16":{"ref":16,"tf":0.02666666666666667},"21":{"ref":21,"tf":0.023076923076923078},"23":{"ref":23,"tf":0.029411764705882353},"24":{"ref":24,"tf":0.015625}}},"a":{"docs":{},"d":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"18":{"ref":18,"tf":0.0056179775280898875},"23":{"ref":23,"tf":3.3627450980392153}}}},"s":{"docs":{},"a":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"18":{"ref":18,"tf":0.0056179775280898875}}}}},"u":{"docs":{},"c":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"4":{"ref":4,"tf":0.01639344262295082},"5":{"ref":5,"tf":0.008547008547008548},"7":{"ref":7,"tf":0.022222222222222223},"15":{"ref":15,"tf":0.03048780487804878},"18":{"ref":18,"tf":0.011235955056179775},"19":{"ref":19,"tf":0.015873015873015872},"20":{"ref":20,"tf":0.018518518518518517}},"e":{"docs":{},"p":{"docs":{},"a":{"docs":{},"n":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"12":{"ref":12,"tf":0.030303030303030304}}}}}}},"t":{"docs":{"6":{"ref":6,"tf":0.017543859649122806}}}},"f":{"docs":{},"e":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}}},"n":{"docs":{},"d":{"docs":{},"i":{"docs":{"22":{"ref":22,"tf":0.05}}}}}},"e":{"docs":{},"r":{"docs":{},"v":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"3":{"ref":3,"tf":0.01764705882352941},"4":{"ref":4,"tf":0.01639344262295082},"6":{"ref":6,"tf":0.008771929824561403},"10":{"ref":10,"tf":0.011494252873563218},"14":{"ref":14,"tf":0.020833333333333332},"15":{"ref":15,"tf":0.006097560975609756},"16":{"ref":16,"tf":0.013333333333333334},"17":{"ref":17,"tf":0.03225806451612903},"18":{"ref":18,"tf":0.028089887640449437},"19":{"ref":19,"tf":0.015873015873015872},"20":{"ref":20,"tf":0.027777777777777776},"25":{"ref":25,"tf":0.00847457627118644}}}},"a":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}},"s":{"docs":{},"o":{"docs":{},"n":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"5":{"ref":5,"tf":0.02564102564102564},"6":{"ref":6,"tf":0.008771929824561403},"15":{"ref":15,"tf":0.006097560975609756},"19":{"ref":19,"tf":0.015873015873015872},"22":{"ref":22,"tf":0.05}}}}}},"t":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"25":{"ref":25,"tf":0.01694915254237288}}},"v":{"docs":{},"e":{"docs":{},"r":{"docs":{"4":{"ref":4,"tf":0.01639344262295082}}}}},"e":{"docs":{},"d":{"docs":{"7":{"ref":7,"tf":0.044444444444444446}}}},"c":{"docs":{},"o":{"docs":{},"n":{"docs":{},"d":{"docs":{"14":{"ref":14,"tf":0.020833333333333332},"21":{"ref":21,"tf":0.007692307692307693}}}}}}},"o":{"docs":{},"u":{"docs":{},"r":{"docs":{},"c":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"1":{"ref":1,"tf":0.013333333333333334},"2":{"ref":2,"tf":0.02564102564102564},"3":{"ref":3,"tf":0.0058823529411764705},"4":{"ref":4,"tf":0.01639344262295082},"5":{"ref":5,"tf":0.008547008547008548},"6":{"ref":6,"tf":0.008771929824561403},"7":{"ref":7,"tf":0.022222222222222223},"8":{"ref":8,"tf":0.018518518518518517},"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.011494252873563218},"11":{"ref":11,"tf":0.015384615384615385},"12":{"ref":12,"tf":0.015151515151515152},"13":{"ref":13,"tf":0.02},"14":{"ref":14,"tf":0.020833333333333332},"15":{"ref":15,"tf":0.006097560975609756},"16":{"ref":16,"tf":0.013333333333333334},"17":{"ref":17,"tf":0.03225806451612903},"18":{"ref":18,"tf":0.0056179775280898875},"19":{"ref":19,"tf":0.015873015873015872},"20":{"ref":20,"tf":0.009259259259259259},"21":{"ref":21,"tf":0.007692307692307693},"22":{"ref":22,"tf":0.05},"23":{"ref":23,"tf":0.029411764705882353},"24":{"ref":24,"tf":0.015625},"25":{"ref":25,"tf":0.00847457627118644}}}},"t":{"docs":{},"h":{"docs":{"12":{"ref":12,"tf":0.015151515151515152}}}},"p":{"docs":{"14":{"ref":14,"tf":3.3541666666666665},"18":{"ref":18,"tf":0.016853932584269662},"19":{"ref":19,"tf":5.015873015873016}}}},"d":{"docs":{},"a":{"docs":{"1":{"ref":1,"tf":0.013333333333333334}}}},"f":{"docs":{},"t":{"docs":{"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.011494252873563218}},"e":{"docs":{},"n":{"docs":{"9":{"ref":9,"tf":0.006097560975609756},"13":{"ref":13,"tf":0.02}}}}}},"y":{"docs":{"20":{"ref":20,"tf":0.018518518518518517}}}},"p":{"docs":{},"o":{"docs":{},"o":{"docs":{},"n":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"10":{"ref":10,"tf":0.011494252873563218}}}}},"r":{"docs":{},"e":{"docs":{},"a":{"docs":{},"d":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"3":{"ref":3,"tf":0.0058823529411764705},"5":{"ref":5,"tf":0.008547008547008548}}}}},"i":{"docs":{},"n":{"docs":{},"k":{"docs":{},"l":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"15":{"ref":15,"tf":0.006097560975609756}}}}}}},"a":{"docs":{},"g":{"docs":{},"h":{"docs":{},"e":{"docs":{},"t":{"docs":{},"t":{"docs":{},"i":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875},"20":{"ref":20,"tf":0.027777777777777776}}}}}}}}},"l":{"docs":{},"i":{"docs":{},"t":{"docs":{"18":{"ref":18,"tf":0.011235955056179775}}}}},"e":{"docs":{},"e":{"docs":{},"d":{"docs":{"24":{"ref":24,"tf":0.015625}}}}}},"u":{"docs":{},"g":{"docs":{},"a":{"docs":{},"r":{"docs":{"0":{"ref":0,"tf":0.03076923076923077},"1":{"ref":1,"tf":0.02666666666666667},"7":{"ref":7,"tf":0.044444444444444446},"9":{"ref":9,"tf":0.018292682926829267},"10":{"ref":10,"tf":0.034482758620689655},"12":{"ref":12,"tf":0.06060606060606061},"13":{"ref":13,"tf":0.04},"15":{"ref":15,"tf":0.018292682926829267},"17":{"ref":17,"tf":0.03225806451612903},"25":{"ref":25,"tf":0.025423728813559324}}}}},"r":{"docs":{},"f":{"docs":{},"a":{"docs":{},"c":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}}}},"n":{"docs":{},"r":{"docs":{},"i":{"docs":{},"s":{"docs":{"17":{"ref":17,"tf":5.032258064516129}}}}}},"p":{"docs":{},"p":{"docs":{},"e":{"docs":{},"r":{"docs":{"18":{"ref":18,"tf":3.338951310861423}}}}}}},"m":{"docs":{},"o":{"docs":{},"o":{"docs":{},"t":{"docs":{},"h":{"docs":{"1":{"ref":1,"tf":0.013333333333333334},"9":{"ref":9,"tf":0.018292682926829267},"11":{"ref":11,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}}}},"a":{"docs":{},"l":{"docs":{},"l":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"7":{"ref":7,"tf":0.022222222222222223},"13":{"ref":13,"tf":0.02},"19":{"ref":19,"tf":0.015873015873015872}}}}}},"t":{"docs":{},"i":{"docs":{},"r":{"docs":{"1":{"ref":1,"tf":0.04},"3":{"ref":3,"tf":0.0058823529411764705},"5":{"ref":5,"tf":0.05128205128205128},"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.022988505747126436},"15":{"ref":15,"tf":0.006097560975609756},"16":{"ref":16,"tf":0.013333333333333334},"18":{"ref":18,"tf":0.033707865168539325},"20":{"ref":20,"tf":0.018518518518518517},"21":{"ref":21,"tf":0.015384615384615385},"25":{"ref":25,"tf":0.00847457627118644}}},"f":{"docs":{},"f":{"docs":{},"l":{"docs":{},"i":{"docs":{"11":{"ref":11,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}}}},"c":{"docs":{},"k":{"docs":{"13":{"ref":13,"tf":0.02},"25":{"ref":25,"tf":0.01694915254237288}}}}},"e":{"docs":{},"a":{"docs":{},"d":{"docs":{},"i":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}}}},"w":{"docs":{"19":{"ref":19,"tf":0.015873015873015872}}}},"r":{"docs":{},"e":{"docs":{},"a":{"docs":{},"m":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}}}}},"o":{"docs":{},"r":{"docs":{},"e":{"docs":{"5":{"ref":5,"tf":0.008547008547008548}}},"a":{"docs":{},"g":{"docs":{"12":{"ref":12,"tf":0.015151515151515152}}}}}},"a":{"docs":{},"n":{"docs":{},"d":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}},"l":{"docs":{},"k":{"docs":{"14":{"ref":14,"tf":0.020833333333333332}}}}},"y":{"docs":{},"l":{"docs":{},"e":{"docs":{"15":{"ref":15,"tf":2.018292682926829},"21":{"ref":21,"tf":3.3410256410256407}}}}},"u":{"docs":{},"d":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}},"h":{"docs":{},"e":{"docs":{},"e":{"docs":{},"t":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"8":{"ref":8,"tf":0.018518518518518517},"9":{"ref":9,"tf":0.006097560975609756}}}},"l":{"docs":{},"l":{"docs":{"21":{"ref":21,"tf":0.015384615384615385},"23":{"ref":23,"tf":0.029411764705882353}}}}},"a":{"docs":{},"p":{"docs":{},"e":{"docs":{"4":{"ref":4,"tf":0.01639344262295082},"9":{"ref":9,"tf":0.006097560975609756}}}},"k":{"docs":{},"e":{"docs":{"17":{"ref":17,"tf":5.032258064516129}}}}},"r":{"docs":{},"e":{"docs":{},"d":{"docs":{"4":{"ref":4,"tf":0.01639344262295082},"18":{"ref":18,"tf":0.011235955056179775}}}}}},"l":{"docs":{},"i":{"docs":{},"g":{"docs":{},"h":{"docs":{},"t":{"docs":{},"l":{"docs":{},"i":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"12":{"ref":12,"tf":0.015151515151515152},"15":{"ref":15,"tf":0.006097560975609756}}}}}}},"c":{"docs":{},"e":{"docs":{"6":{"ref":6,"tf":0.02631578947368421},"15":{"ref":15,"tf":0.012195121951219513},"20":{"ref":20,"tf":0.018518518518518517},"21":{"ref":21,"tf":0.007692307692307693}}}}},"o":{"docs":{},"w":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"15":{"ref":15,"tf":2.024390243902439},"16":{"ref":16,"tf":3.3466666666666662}}}},"a":{"docs":{},"w":{"docs":{"7":{"ref":7,"tf":5.022222222222222}}}}},"i":{"docs":{},"z":{"docs":{},"e":{"docs":{"5":{"ref":5,"tf":0.008547008547008548}}}},"m":{"docs":{},"m":{"docs":{},"e":{"docs":{},"r":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"16":{"ref":16,"tf":0.013333333333333334},"19":{"ref":19,"tf":0.015873015873015872},"20":{"ref":20,"tf":0.018518518518518517},"25":{"ref":25,"tf":0.00847457627118644}}}}}},"d":{"docs":{},"e":{"docs":{"14":{"ref":14,"tf":0.041666666666666664}}}}},"k":{"docs":{},"i":{"docs":{},"l":{"docs":{},"l":{"docs":{},"e":{"docs":{},"t":{"docs":{"6":{"ref":6,"tf":0.02631578947368421},"18":{"ref":18,"tf":0.0056179775280898875},"20":{"ref":20,"tf":0.009259259259259259},"21":{"ref":21,"tf":0.007692307692307693}}}}}},"n":{"docs":{},"l":{"docs":{},"e":{"docs":{},"s":{"docs":{},"s":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"20":{"ref":20,"tf":0.009259259259259259},"21":{"ref":21,"tf":0.007692307692307693}}}}}}}}},"q":{"docs":{},"u":{"docs":{},"a":{"docs":{},"s":{"docs":{},"h":{"docs":{"9":{"ref":9,"tf":0.012195121951219513},"18":{"ref":18,"tf":0.0056179775280898875}}}}},"i":{"docs":{},"s":{"docs":{},"h":{"docs":{"19":{"ref":19,"tf":0.015873015873015872}}}}}}},"y":{"docs":{},"r":{"docs":{},"u":{"docs":{},"p":{"docs":{"12":{"ref":12,"tf":5.045454545454546}}}}}},"w":{"docs":{},"i":{"docs":{},"s":{"docs":{},"s":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}}}}},"n":{"docs":{},"a":{"docs":{},"p":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}}},"t":{"docs":{},"o":{"docs":{},"p":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"3":{"ref":3,"tf":0.0058823529411764705},"9":{"ref":9,"tf":0.006097560975609756},"13":{"ref":13,"tf":0.02},"15":{"ref":15,"tf":0.006097560975609756}}},"g":{"docs":{},"e":{"docs":{},"t":{"docs":{},"h":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"7":{"ref":7,"tf":0.022222222222222223},"13":{"ref":13,"tf":0.02},"19":{"ref":19,"tf":0.015873015873015872}}}}}},"m":{"docs":{},"a":{"docs":{},"t":{"docs":{},"o":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"16":{"ref":16,"tf":0.02666666666666667},"19":{"ref":19,"tf":0.047619047619047616}}}}}},"r":{"docs":{},"t":{"docs":{},"i":{"docs":{},"l":{"docs":{},"l":{"docs":{},"a":{"docs":{"3":{"ref":3,"tf":0.011764705882352941}}}}}}}},"w":{"docs":{},"e":{"docs":{},"l":{"docs":{"5":{"ref":5,"tf":0.008547008547008548},"15":{"ref":15,"tf":0.006097560975609756}}}}},"o":{"docs":{},"t":{"docs":{},"h":{"docs":{},"p":{"docs":{},"i":{"docs":{},"c":{"docs":{},"k":{"docs":{"13":{"ref":13,"tf":0.02}}}}}}}}},"s":{"docs":{},"s":{"docs":{"21":{"ref":21,"tf":0.007692307692307693}}}}},"s":{"docs":{},"p":{"docs":{"0":{"ref":0,"tf":0.046153846153846156},"1":{"ref":1,"tf":0.04},"5":{"ref":5,"tf":0.02564102564102564},"6":{"ref":6,"tf":0.03508771929824561},"7":{"ref":7,"tf":0.044444444444444446},"8":{"ref":8,"tf":0.05555555555555555},"9":{"ref":9,"tf":0.024390243902439025},"10":{"ref":10,"tf":0.022988505747126436},"11":{"ref":11,"tf":0.015384615384615385},"14":{"ref":14,"tf":0.041666666666666664},"16":{"ref":16,"tf":0.013333333333333334},"17":{"ref":17,"tf":0.06451612903225806},"21":{"ref":21,"tf":0.015384615384615385},"23":{"ref":23,"tf":0.058823529411764705},"24":{"ref":24,"tf":0.015625}}}},"b":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}},"s":{"docs":{},"p":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"4":{"ref":4,"tf":0.04918032786885246},"5":{"ref":5,"tf":0.017094017094017096},"6":{"ref":6,"tf":0.008771929824561403},"7":{"ref":7,"tf":0.044444444444444446},"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.011494252873563218},"11":{"ref":11,"tf":0.015384615384615385},"16":{"ref":16,"tf":0.013333333333333334},"20":{"ref":20,"tf":0.037037037037037035},"21":{"ref":21,"tf":0.023076923076923078},"24":{"ref":24,"tf":0.015625}}}}},"i":{"docs":{},"m":{"docs":{},"e":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"25":{"ref":25,"tf":0.01694915254237288}}}},"l":{"docs":{},"a":{"docs":{},"p":{"docs":{},"i":{"docs":{},"a":{"docs":{"22":{"ref":22,"tf":10.1}}}}}}}},"u":{"docs":{},"r":{"docs":{},"n":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"8":{"ref":8,"tf":0.018518518518518517},"9":{"ref":9,"tf":0.012195121951219513},"14":{"ref":14,"tf":0.020833333333333332},"15":{"ref":15,"tf":0.006097560975609756}}},"k":{"docs":{},"e":{"docs":{},"y":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}}}}},"n":{"docs":{},"a":{"docs":{"23":{"ref":23,"tf":3.3921568627450975}}}}},"a":{"docs":{},"b":{"docs":{},"l":{"docs":{},"e":{"docs":{},"s":{"docs":{},"p":{"docs":{},"o":{"docs":{},"o":{"docs":{},"n":{"docs":{"3":{"ref":3,"tf":0.01764705882352941},"18":{"ref":18,"tf":0.011235955056179775},"25":{"ref":25,"tf":0.00847457627118644}}}}}}}}}},"s":{"docs":{},"t":{"docs":{"3":{"ref":3,"tf":0.01764705882352941},"25":{"ref":25,"tf":0.00847457627118644}}}},"c":{"docs":{},"o":{"docs":{"19":{"ref":19,"tf":5.0476190476190474}}}}},"e":{"docs":{},"a":{"docs":{},"s":{"docs":{},"p":{"docs":{},"o":{"docs":{},"o":{"docs":{},"n":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"12":{"ref":12,"tf":0.030303030303030304},"15":{"ref":15,"tf":0.012195121951219513}}}}}}}},"m":{"docs":{},"p":{"docs":{},"e":{"docs":{},"r":{"docs":{},"a":{"docs":{},"t":{"docs":{},"u":{"docs":{},"r":{"docs":{"14":{"ref":14,"tf":0.020833333333333332}}}}}}}}}},"n":{"docs":{},"d":{"docs":{},"e":{"docs":{},"r":{"docs":{"18":{"ref":18,"tf":0.011235955056179775},"20":{"ref":20,"tf":0.009259259259259259}}}}}}},"h":{"docs":{},"i":{"docs":{},"c":{"docs":{},"k":{"docs":{},"e":{"docs":{},"n":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}}}}},"r":{"docs":{},"d":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}},"n":{"docs":{"20":{"ref":20,"tf":0.009259259259259259}},"l":{"docs":{},"i":{"docs":{"15":{"ref":15,"tf":0.006097560975609756},"21":{"ref":21,"tf":0.007692307692307693}}}}}},"r":{"docs":{},"o":{"docs":{},"u":{"docs":{},"g":{"docs":{},"h":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"18":{"ref":18,"tf":0.011235955056179775},"20":{"ref":20,"tf":0.009259259259259259}}}}}}},"o":{"docs":{},"r":{"docs":{},"o":{"docs":{},"u":{"docs":{},"g":{"docs":{},"h":{"docs":{},"l":{"docs":{},"i":{"docs":{"5":{"ref":5,"tf":0.008547008547008548},"10":{"ref":10,"tf":0.011494252873563218}}}}}}}}},"s":{"docs":{},"e":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}},"e":{"docs":{},"y":{"docs":{},"'":{"docs":{},"r":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}},"l":{"docs":{},"l":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}}}},"a":{"docs":{},"i":{"docs":{"20":{"ref":20,"tf":3.342592592592592},"21":{"ref":21,"tf":3.3410256410256407}}}}},"r":{"docs":{},"a":{"docs":{},"n":{"docs":{},"s":{"docs":{},"p":{"docs":{},"a":{"docs":{},"r":{"docs":{"6":{"ref":6,"tf":0.008771929824561403}}}}}}}},"i":{"docs":{},"m":{"docs":{"15":{"ref":15,"tf":0.006097560975609756},"21":{"ref":21,"tf":0.007692307692307693}}}}}},"u":{"docs":{},"n":{"docs":{},"t":{"docs":{},"i":{"docs":{},"l":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"1":{"ref":1,"tf":0.02666666666666667},"2":{"ref":2,"tf":0.02564102564102564},"3":{"ref":3,"tf":0.011764705882352941},"4":{"ref":4,"tf":0.01639344262295082},"5":{"ref":5,"tf":0.017094017094017096},"6":{"ref":6,"tf":0.017543859649122806},"9":{"ref":9,"tf":0.036585365853658534},"10":{"ref":10,"tf":0.022988505747126436},"11":{"ref":11,"tf":0.03076923076923077},"13":{"ref":13,"tf":0.02},"18":{"ref":18,"tf":0.02247191011235955},"20":{"ref":20,"tf":0.027777777777777776},"21":{"ref":21,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.03125}}}}},"c":{"docs":{},"o":{"docs":{},"v":{"docs":{"5":{"ref":5,"tf":0.017094017094017096}}},"o":{"docs":{},"k":{"docs":{"20":{"ref":20,"tf":0.009259259259259259}}}}}},"d":{"docs":{},"r":{"docs":{},"a":{"docs":{},"i":{"docs":{},"n":{"docs":{"16":{"ref":16,"tf":0.02666666666666667}}}}}}}},"p":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"24":{"ref":24,"tf":0.015625},"25":{"ref":25,"tf":0.00847457627118644}}},"s":{"docs":{"13":{"ref":13,"tf":0.02},"18":{"ref":18,"tf":0.011235955056179775},"25":{"ref":25,"tf":0.00847457627118644}},"u":{"docs":{},"a":{"docs":{},"l":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}}}},"v":{"docs":{},"a":{"docs":{},"n":{"docs":{},"i":{"docs":{},"l":{"docs":{},"l":{"docs":{},"a":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"10":{"ref":10,"tf":0.022988505747126436},"12":{"ref":12,"tf":0.030303030303030304},"17":{"ref":17,"tf":0.03225806451612903}}}}}}}},"e":{"docs":{},"g":{"docs":{},"e":{"docs":{},"t":{"docs":{"1":{"ref":1,"tf":0.013333333333333334},"3":{"ref":3,"tf":0.0058823529411764705},"6":{"ref":6,"tf":0.017543859649122806},"18":{"ref":18,"tf":0.011235955056179775}}}}}},"i":{"docs":{},"n":{"docs":{},"e":{"docs":{},"g":{"docs":{},"a":{"docs":{},"r":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"7":{"ref":7,"tf":0.044444444444444446}}}}}}}}},"w":{"docs":{},"e":{"docs":{},"l":{"docs":{},"l":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"4":{"ref":4,"tf":0.01639344262295082},"18":{"ref":18,"tf":0.011235955056179775},"21":{"ref":21,"tf":0.007692307692307693},"25":{"ref":25,"tf":0.00847457627118644}}}}},"a":{"docs":{},"t":{"docs":{},"e":{"docs":{},"r":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"9":{"ref":9,"tf":0.012195121951219513},"12":{"ref":12,"tf":0.030303030303030304},"20":{"ref":20,"tf":0.009259259259259259},"21":{"ref":21,"tf":0.007692307692307693}}}}},"r":{"docs":{},"m":{"docs":{"9":{"ref":9,"tf":0.024390243902439025}}}},"f":{"docs":{},"f":{"docs":{},"l":{"docs":{"11":{"ref":11,"tf":2.5307692307692307},"24":{"ref":24,"tf":10.03125}}}}},"s":{"docs":{},"h":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}},"s":{"docs":{},"a":{"docs":{},"i":{"docs":{},"l":{"docs":{"25":{"ref":25,"tf":10.008474576271187}}}}}}}},"h":{"docs":{},"e":{"docs":{},"a":{"docs":{},"t":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"5":{"ref":5,"tf":0.008547008547008548},"9":{"ref":9,"tf":0.012195121951219513}}}}},"i":{"docs":{},"s":{"docs":{},"k":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}}},"p":{"docs":{"10":{"ref":10,"tf":0.034482758620689655}}},"t":{"docs":{},"e":{"docs":{"10":{"ref":10,"tf":0.022988505747126436},"11":{"ref":11,"tf":0.046153846153846156},"12":{"ref":12,"tf":0.030303030303030304},"24":{"ref":24,"tf":0.046875}}}}},"o":{"docs":{},"l":{"docs":{},"e":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"25":{"ref":25,"tf":0.00847457627118644}}}}}},"o":{"docs":{},"r":{"docs":{},"c":{"docs":{},"e":{"docs":{},"s":{"docs":{},"t":{"docs":{},"e":{"docs":{},"r":{"docs":{},"s":{"docs":{},"h":{"docs":{},"i":{"docs":{},"r":{"docs":{"4":{"ref":4,"tf":0.01639344262295082},"5":{"ref":5,"tf":0.008547008547008548}}}}}}}}}}}}},"k":{"docs":{"14":{"ref":14,"tf":0.020833333333333332}}}},"i":{"docs":{},"d":{"docs":{},"e":{"docs":{"6":{"ref":6,"tf":0.008771929824561403}}}},"r":{"docs":{},"e":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}}}},"y":{"docs":{},"i":{"docs":{},"e":{"docs":{},"l":{"docs":{},"d":{"docs":{"0":{"ref":0,"tf":0.015384615384615385},"1":{"ref":1,"tf":0.013333333333333334},"2":{"ref":2,"tf":0.02564102564102564},"3":{"ref":3,"tf":0.0058823529411764705},"4":{"ref":4,"tf":0.01639344262295082},"5":{"ref":5,"tf":0.008547008547008548},"6":{"ref":6,"tf":0.008771929824561403},"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.011494252873563218},"15":{"ref":15,"tf":0.006097560975609756},"16":{"ref":16,"tf":0.013333333333333334},"17":{"ref":17,"tf":0.03225806451612903},"18":{"ref":18,"tf":0.0056179775280898875},"19":{"ref":19,"tf":0.015873015873015872},"20":{"ref":20,"tf":0.009259259259259259}}}}}},"e":{"docs":{},"a":{"docs":{},"s":{"docs":{},"t":{"docs":{"9":{"ref":9,"tf":0.012195121951219513}}}}}},"o":{"docs":{},"l":{"docs":{},"k":{"docs":{"10":{"ref":10,"tf":0.022988505747126436},"11":{"ref":11,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}},"g":{"docs":{},"u":{"docs":{},"r":{"docs":{},"t":{"docs":{"17":{"ref":17,"tf":0.03225806451612903}}}}}}}},"l":{"docs":{},"b":{"docs":{"2":{"ref":2,"tf":0.02564102564102564},"6":{"ref":6,"tf":0.008771929824561403},"13":{"ref":13,"tf":0.02},"16":{"ref":16,"tf":0.013333333333333334},"21":{"ref":21,"tf":0.015384615384615385}}},"a":{"docs":{"18":{"ref":18,"tf":3.338951310861423}},"r":{"docs":{},"g":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"4":{"ref":4,"tf":0.01639344262295082},"5":{"ref":5,"tf":0.017094017094017096},"6":{"ref":6,"tf":0.008771929824561403},"9":{"ref":9,"tf":0.006097560975609756},"11":{"ref":11,"tf":0.015384615384615385},"15":{"ref":15,"tf":0.006097560975609756},"20":{"ref":20,"tf":0.009259259259259259},"21":{"ref":21,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}},"t":{"docs":{},"e":{"docs":{},"r":{"docs":{"12":{"ref":12,"tf":0.015151515151515152}}}}},"b":{"docs":{},"e":{"docs":{},"l":{"docs":{"21":{"ref":21,"tf":0.007692307692307693}}}}}},"i":{"docs":{},"m":{"docs":{},"e":{"docs":{"3":{"ref":3,"tf":0.01764705882352941}}}},"s":{"docs":{},"t":{"docs":{"8":{"ref":8,"tf":0.018518518518518517}}}},"g":{"docs":{},"h":{"docs":{},"t":{"docs":{"11":{"ref":11,"tf":2.5153846153846153},"15":{"ref":15,"tf":0.006097560975609756},"21":{"ref":21,"tf":0.007692307692307693}},"l":{"docs":{},"i":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}}}}}},"q":{"docs":{},"u":{"docs":{},"i":{"docs":{},"d":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}}}}},"t":{"docs":{},"t":{"docs":{},"l":{"docs":{"15":{"ref":15,"tf":0.006097560975609756}}}}}},"o":{"docs":{},"n":{"docs":{},"g":{"docs":{},"e":{"docs":{},"r":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"15":{"ref":15,"tf":0.006097560975609756}}}}}},"w":{"docs":{"11":{"ref":11,"tf":0.015384615384615385},"15":{"ref":15,"tf":0.012195121951219513},"16":{"ref":16,"tf":0.013333333333333334},"20":{"ref":20,"tf":0.009259259259259259},"24":{"ref":24,"tf":0.015625},"25":{"ref":25,"tf":0.00847457627118644}},"e":{"docs":{},"r":{"docs":{"25":{"ref":25,"tf":0.00847457627118644}}}}}},"e":{"docs":{},"s":{"docs":{},"s":{"docs":{"12":{"ref":12,"tf":0.015151515151515152}}}},"a":{"docs":{},"v":{"docs":{"13":{"ref":13,"tf":0.02}}}},"m":{"docs":{},"o":{"docs":{},"n":{"docs":{"21":{"ref":21,"tf":0.015384615384615385},"22":{"ref":22,"tf":0.05}}}}}}},"h":{"docs":{},"e":{"docs":{},"a":{"docs":{},"t":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"5":{"ref":5,"tf":0.008547008547008548},"10":{"ref":10,"tf":0.011494252873563218},"14":{"ref":14,"tf":0.020833333333333332},"18":{"ref":18,"tf":0.016853932584269662},"20":{"ref":20,"tf":0.027777777777777776},"21":{"ref":21,"tf":0.023076923076923078},"25":{"ref":25,"tf":0.01694915254237288}}}},"l":{"docs":{},"l":{"docs":{},"m":{"docs":{},"a":{"docs":{},"n":{"docs":{"7":{"ref":7,"tf":0.022222222222222223}}}}}},"p":{"docs":{"12":{"ref":12,"tf":0.015151515151515152}}}}},"o":{"docs":{},"t":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"18":{"ref":18,"tf":0.0056179775280898875}}},"u":{"docs":{},"r":{"docs":{"4":{"ref":4,"tf":0.01639344262295082},"5":{"ref":5,"tf":0.008547008547008548},"9":{"ref":9,"tf":0.006097560975609756},"10":{"ref":10,"tf":0.011494252873563218},"15":{"ref":15,"tf":0.012195121951219513},"16":{"ref":16,"tf":0.013333333333333334},"25":{"ref":25,"tf":0.025423728813559324}}}},"n":{"docs":{},"e":{"docs":{},"y":{"docs":{"25":{"ref":25,"tf":0.025423728813559324}}}}}},"i":{"docs":{},"g":{"docs":{},"h":{"docs":{"5":{"ref":5,"tf":0.017094017094017096},"14":{"ref":14,"tf":0.020833333333333332},"18":{"ref":18,"tf":0.011235955056179775},"21":{"ref":21,"tf":0.007692307692307693}}}}},"a":{"docs":{},"n":{"docs":{},"d":{"docs":{"11":{"ref":11,"tf":0.015384615384615385},"24":{"ref":24,"tf":0.015625}}}},"l":{"docs":{},"v":{"docs":{"15":{"ref":15,"tf":0.006097560975609756},"21":{"ref":21,"tf":0.007692307692307693}}},"f":{"docs":{"25":{"ref":25,"tf":0.01694915254237288}}}},"m":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}}}},"j":{"docs":{},"a":{"docs":{},"c":{"docs":{},"k":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}}}},"u":{"docs":{},"i":{"docs":{},"c":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"15":{"ref":15,"tf":0.024390243902439025},"17":{"ref":17,"tf":0.03225806451612903},"21":{"ref":21,"tf":0.015384615384615385},"22":{"ref":22,"tf":0.05},"25":{"ref":25,"tf":0.01694915254237288}}}}}},"n":{"docs":{"11":{"ref":11,"tf":2.5153846153846153}},"o":{"docs":{},"n":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}},"f":{"docs":{},"a":{"docs":{},"t":{"docs":{"17":{"ref":17,"tf":0.03225806451612903}}}}}},"o":{"docs":{},"d":{"docs":{},"l":{"docs":{"6":{"ref":6,"tf":0.03508771929824561}}}}}},"u":{"docs":{},"t":{"docs":{"4":{"ref":4,"tf":0.04918032786885246},"5":{"ref":5,"tf":0.008547008547008548}},"m":{"docs":{},"e":{"docs":{},"g":{"docs":{"10":{"ref":10,"tf":0.022988505747126436},"25":{"ref":25,"tf":0.01694915254237288}}}}}}},"e":{"docs":{},"e":{"docs":{},"d":{"docs":{"8":{"ref":8,"tf":0.018518518518518517}}}}}},"r":{"docs":{},"e":{"docs":{},"d":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"21":{"ref":21,"tf":0.015384615384615385}},"u":{"docs":{},"c":{"docs":{"20":{"ref":20,"tf":0.009259259259259259}}}}},"m":{"docs":{},"a":{"docs":{},"i":{"docs":{},"n":{"docs":{"5":{"ref":5,"tf":0.017094017094017096},"6":{"ref":6,"tf":0.008771929824561403},"9":{"ref":9,"tf":0.012195121951219513},"20":{"ref":20,"tf":0.009259259259259259}}}}},"o":{"docs":{},"v":{"docs":{"6":{"ref":6,"tf":0.008771929824561403},"9":{"ref":9,"tf":0.006097560975609756}}}}},"f":{"docs":{},"r":{"docs":{},"i":{"docs":{},"g":{"docs":{},"e":{"docs":{},"r":{"docs":{"13":{"ref":13,"tf":0.02},"20":{"ref":20,"tf":0.009259259259259259}}}}}}}},"a":{"docs":{},"d":{"docs":{},"i":{"docs":{"20":{"ref":20,"tf":0.009259259259259259}}}}},"t":{"docs":{},"u":{"docs":{},"r":{"docs":{},"n":{"docs":{"21":{"ref":21,"tf":0.007692307692307693}}}}}}},"i":{"docs":{},"c":{"docs":{},"e":{"docs":{"3":{"ref":3,"tf":0.011764705882352941},"5":{"ref":5,"tf":0.008547008547008548}}}},"n":{"docs":{},"s":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}}},"p":{"docs":{},"e":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705}}}},"s":{"docs":{},"e":{"docs":{"9":{"ref":9,"tf":0.012195121951219513}}}},"b":{"docs":{"15":{"ref":15,"tf":2.0365853658536586}}}},"o":{"docs":{},"l":{"docs":{},"l":{"docs":{"3":{"ref":3,"tf":0.0058823529411764705},"4":{"ref":4,"tf":0.01639344262295082},"9":{"ref":9,"tf":5.012195121951219}}}},"a":{"docs":{},"s":{"docs":{},"t":{"docs":{"5":{"ref":5,"tf":0.008547008547008548}}}}},"t":{"docs":{},"e":{"docs":{},"l":{"docs":{"19":{"ref":19,"tf":0.015873015873015872}}}}}},"a":{"docs":{},"c":{"docs":{},"k":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}},"n":{"docs":{},"c":{"docs":{},"h":{"docs":{"19":{"ref":19,"tf":0.031746031746031744}}}}}}},"k":{"docs":{},"n":{"docs":{},"e":{"docs":{},"a":{"docs":{},"d":{"docs":{"9":{"ref":9,"tf":0.006097560975609756}}}}}},"i":{"docs":{},"d":{"docs":{},"n":{"docs":{},"e":{"docs":{},"y":{"docs":{"16":{"ref":16,"tf":0.02666666666666667}}}}}},"e":{"docs":{},"l":{"docs":{},"b":{"docs":{},"a":{"docs":{},"s":{"docs":{},"a":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}}}}}}},"n":{"docs":{},"g":{"docs":{"18":{"ref":18,"tf":3.338951310861423}}}}},"r":{"docs":{},"a":{"docs":{},"f":{"docs":{},"t":{"docs":{"20":{"ref":20,"tf":0.009259259259259259}}}}}}},"z":{"docs":{},"u":{"docs":{},"c":{"docs":{},"c":{"docs":{},"h":{"docs":{},"i":{"docs":{},"n":{"docs":{},"i":{"docs":{"18":{"ref":18,"tf":0.0056179775280898875}}}}}}}}}}},"length":1413},"corpusTokens":["1","1.5","1/2","1/3","1/4","1/8","10","11","110f","115f","12","13x9x2","14.5oz","14oz","15","16","16oz","17","18","1lb","1tsp","2","2/3","20","25","250f","275f","28oz","2tsp","3","3/4","30","35","350f","350°f","4","45","5","6","7","8","8oz","9","about.com](http://southernfood.about.com/od/crockpotporkandham/r/r80418g.htm","abov","accompani","accord","activ","ad","add","addit","ahead","airtight","allow","allspic","along","american","amish","and/or","anoth","appl","arrang","asid","asparagu","avocado","bagel","bake","ball","banana","barbecu","basil","bast","batter","bean","beat","beaten","beef","bell","ben","biscuit","bite","black","blend","boil","boneless","bottl","bottom","bowl","box","brandi","breast","bring","broccoli","broken","broth","brown","brush","buckey","burrito","butter","butter/marg","butternut","cabbag","cacciator","can","candi","canola","carefulli","carrot","casserol","catalina","celeri","center","cheddar","chees","chex","chicken","chili","chill","chip","chocol","choos","chop","cider","cilantro","cinnamon","clove","coars","coat","coconut","cole","combin","condens","confectioner'","constantli","contain","cook","cookbook","cooker","cooki","cool","corn","countri","coupl","cover","cream","creami","creol","crisp","crockeri","crockpot","crush","crystal","cube","cumin","cup","custard","cut","cyan","dairi","dakota","dash","dice","dinner","dip","direct","dish","dish/pan","dissolv","distribut","divid","done","dot","doubl","dough","down","dozen","drain","dress","dri","each","edg","edgin","egg","eggnog","ehmk","elast","elsi","emili","enough","epp","evenli","except","excess","expos","extra","fat","favorit","few","fill","final","fine","finish","firm","flake","flavor","float","floret","flour","foami","fold","foods](http://www.wholefoodsmarket.com/recipes/1699","form","fresh","fruit","full","gallon","garlic","germ","ginger","glove","golden","gradual","grammi","grampi","grate","grated,peel","greas","great","green","grid","ground","half","halv","ham","hand","heat","hellman","help","high","honey","hot","hour","immedi","inch","increas","ingredi","insert","instant","island","italian","jack","juic","kidney","kielbasa","king","knead","kraft","la","label","larg","later","lb","leav","lemon","less","light","lightli","lime","liquid","list","littl","longer","low","lower","macaroni","make","maker","mapl","margarin","marion","mash","mayonnais","meat","meati","med","medium","melt","microwav","milk","min","minc","mini","minut","mix","mixer","mixtur","moisten","mom","monterey","more","muenster","muffin","mushroom","n","need","non","nonfat","noodl","nut","nutmeg","oat","oatmeal","occasion","ohio","oil","oliv","onc","onion","onto","option","orang","ounc","oven","over","oz","pack","packag","pan","paper","paprika","parmesan","parti","pasta","pat","peak","peanut","peel","pepper","piec","pimento","pineappl","pink","pinto","pkg","place","plain","platter","plenti","pork","portion","pot","potato","pound","pour","powder","preheat","prep","prepar","pretzel","prevent","prior","puff","punch","purchasedbarbecu","put","quart","quick","rack","ranch","readi","red","reduc","refriger","remain","remov","return","rib","rice","rins","ripe","rise","roast","roll","rotel","safe","salad","salsa","salt","sandi","sauc","saucepan","saut","sea","season","second","seed","serv","set","sever","shake","shape","sheet","shell","shred","side","simmer","size","skillet","skinless","slaw","slice","slightli","slow","small","smooth","snap","soda","soft","soften","soup","sourc","south","soy","spaghetti","speed","split","spoon","spread","sprinkl","squash","squish","stalk","stand","steadi","stew","stick","stiffli","stir","storag","store","stream","stud","style","sugar","sunris","supper","surfac","swiss","syrup","tablespoon","taco","tast","tb","tbsp","teaspoon","temperatur","tender","thai","they'll","they'r","thicken","thin","thinli","third","thoroughli","those","through","tilapia","time","togeth","tomato","toothpick","top","tortilla","toss","towel","transpar","trim","tsp","tuna","turkey","turn","uncook","uncov","undrain","until","up","us","usual","vanilla","veget","vinegar","waffl","warm","wash","wassail","water","well","wheat","whip","whisk","white","whole","wide","wire","wok","worcestershir","yeast","yield","yogurt","yolk","zucchini"],"pipeline":["trimmer","stopWordFilter","stemmer"]}
);

function render(template, locals) {
    return templates[template](locals);
}

function ready(fn) {
  if (document.readyState != 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

ready(function () {
    var autocompleteView;
    var searchInput = document.querySelector('input[type=search]');
    
    searchInput.addEventListener('keyup', function (e) {
        var searchValue = searchInput.value.trim();
        
        if (searchValue === "") {
            if (autocompleteView !== undefined) {
                autocompleteView.parentNode.removeChild(autocompleteView);
                autocompleteView = undefined;
            }
        } else {
            results = lr.search(searchValue).map(function(sv) {
                return recipes[parseInt(sv.ref)];
            });
            
            if (autocompleteView) {
                autocompleteView.children[0].innerHTML = render('autocomplete/results', {results: results});
            } else if (results.length > 0) {
                var box = searchInput.getBoundingClientRect();
                
                autocompleteView = document.createElement('div');
                autocompleteView.className = 'autocomplete-container';
                autocompleteView.style.top = box.top + 1 + box.height + 'px';
                autocompleteView.innerHTML = render('autocomplete', {results: results});
                autocompleteView.children[0].style.left = box.left + 'px';
                autocompleteView.children[0].style.width = box.width + 'px';
                autocompleteView.children[0].style.paddingLeft = window.getComputedStyle(searchInput, null).getPropertyValue('padding-left');
                
                document.body.appendChild(autocompleteView);
            }

        }
    });
})
;
