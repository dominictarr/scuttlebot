var Graphmitter = require('graphmitter')
var pull        = require('pull-stream')
var mlib        = require('ssb-msgs')
var memview     = require('level-memview')
var cont        = require('cont')

function isFunction (f) {
  return 'function' === typeof f
}

function isString (s) {
  return 'string' === typeof s
}

exports.name = 'friends'
exports.version = '1.0.0'
exports.manifest = {
  all  : 'async',
  hops : 'async'
}

//note: this *MUST* be used with {sync: true} option,
//      as added to pull-level@1.3

function sync (createStream, update) {
  var ready = false, waiting = []
  pull(
    createStream({sync: true, live: true}),
    pull.filter(function (data) {
      if(!data.sync) return true
      ready = true
      while(waiting.length) waiting.shift()()
    }),
    pull.drain(update)
  )

  return function await (cb) {
    if(ready) cb()
    else waiting.push(cb)
  }
}

exports.init = function (sbot, config) {

  var graphs = {
    follow: new Graphmitter(),
    trust: new Graphmitter()
  }

  // view processor

  var awaitSync = sync(
    sbot.createLogStream,
    function update (msg) {
      var c = msg.value.content

      if (c.type == 'contact') {

        mlib.asLinks(c.contact).forEach(function (link) {
          if ('following' in c) {
            if (c.following)
              graphs.follow.edge(msg.value.author, link.feed, true)
            else
              graphs.follow.del(msg.value.author, link.feed)
          }
          if ('trust' in c) {
            var trust = c.trust|0
            if (trust !== 0)
              graphs.trust.edge(msg.value.author, link.feed, (+trust > 0) ? 1 : -1)
            else
              graphs.trust.del(msg.value.author, link.feed)
          }
        })
      }
    }
    )

  return {
    all: cont(function (graph, cb) {
      if (typeof graph == 'function') {
        cb = graph
        graph = null
      }
      if (!graph)
        graph = 'follow'
      awaitSync(function () {
        cb(null, graphs[graph] ? graphs[graph].toJSON() : null)
      })
    }),
    hops: cont(function (opts, cb) {
      opts = opts || {}
      var start = opts.start
      var graph = opts.graph

      var conf = config.friends || {}
      opts.start  = opts.start  || config.id
      opts.dunbar = opts.dunbar || conf.dunbar || 150
      opts.hops   = opts.hops   || conf.hops   || 3

      var g = graphs[graph || 'follow']
      if (!g)
        return cb(new Error('Invalid graph type: '+graph))

      awaitSync(function () {
        cb(null, g.traverse(opts))
      })
    })
  }
}
