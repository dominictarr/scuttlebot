var ssbKeys = require('ssb-keys')
var createFeed = require('ssb-feed')
var schemas = require('ssb-msg-schemas')
var cont    = require('cont')
var tape    = require('tape')


tape('simple graph', function (t) {

  var u = require('./util')

  var server = u.createDB('test-friends0', {
      port: 45451, host: 'localhost', timeout: 1000,
    }).use(require('../plugins/friends'))

  var api = server.api()

  var alice = createFeed(api, ssbKeys.generate(), ssbKeys)
  var bob   = createFeed(api, ssbKeys.generate(), ssbKeys)
  var carol = createFeed(api, ssbKeys.generate(), ssbKeys)

  cont.para([
    cont(schemas.addContact)(alice, bob.id,   { following: true }),
    cont(schemas.addContact)(alice, carol.id, { following: true }),
//    cont(schemas.addContact)(bob, alice.id, { following: true} )
  ]) (function (err) {
    if(err) throw err

  //  setTimeout(function () {

      cont.para([
        cont(api.friends.all)(),

        cont(api.friends.hops)({start: alice.id, graph: 'follow'}),

      ], function (err, results) {

        var aliasMap = {}
        aliasMap[alice.id] = 'alice'
        aliasMap[bob.id]   = 'bob'
        aliasMap[carol.id] = 'carol'
        console.log(results)
        results = results.map(toAliases(aliasMap))
        console.log(aliasMap)
        var i = 0

        console.log(results)

        t.deepEqual(results[i++],
          { alice: { bob: true, carol: true }, bob: {  }, carol: { } },
          'all friends'
        )

        t.deepEqual(results[i++], { alice: 0, bob: 1, carol: 1 })

        t.end()
        server.close()
      })
  })
})

// create 3 feeds
// add some of friend edges (follow, trust, flag)
// make sure the friends plugin analyzes correctly

tape('construct and analyze graph', function (t) {

  var u = require('./util')

  var server = u.createDB('test-friends1', {
      port: 45451, host: 'localhost', timeout: 1000,
    }).use(require('../plugins/friends'))

  var api = server.api()

  var alice = createFeed(api, ssbKeys.generate(), ssbKeys)
  var bob   = createFeed(api, ssbKeys.generate(), ssbKeys)
  var carol = createFeed(api, ssbKeys.generate(), ssbKeys)

  var addContact = cont(schemas.addContact)

  cont.para([
    addContact(alice, bob.id,   { following: true, trust: 1 }),
    addContact(alice, carol.id, { following: true, trust: 0 }),
    addContact(bob, alice.id, { following: true, trust: 1 }),
    addContact(bob, carol.id, { following: false, trust: -1 }),
    addContact(carol, alice.id, { following: true })
  ]) (function () {

    cont.para([
      api.friends.all(),
      api.friends.all('follow'),
      api.friends.all('trust'),

      api.friends.hops({start: alice.id}),
      api.friends.hops({start: alice.id, graph: 'follow'}),
      api.friends.hops({start: alice.id, graph: 'trust'}),

      api.friends.hops({start: bob.id, graph: 'follow'}),
      api.friends.hops({start: bob.id, graph: 'trust'}),

      api.friends.hops({start: carol.id, graph: 'follow'}),
      api.friends.hops({start: carol.id, graph: 'trust'})
    ], function (err, results) {

      var aliasMap = {}
      aliasMap[alice.id] = 'alice'
      aliasMap[bob.id]   = 'bob'
      aliasMap[carol.id] = 'carol'

      results = results.map(toAliases(aliasMap))
      console.log(aliasMap)
      var i = 0

      t.deepEqual(results[i++],
        { alice: { bob: true, carol: true }, bob: { alice: true }, carol: { alice: true } },
        'all friends'
      )
      t.deepEqual(results[i++],
        { alice: { bob: true, carol: true }, bob: { alice: true }, carol: { alice: true } },
        'all follows'
      )
      t.deepEqual(results[i++],
        { alice: { bob: 1 }, bob: { alice: 1, carol: -1 }, carol: {} },
        'all trusts'
      )

      t.deepEqual(results[i++], { alice: 0, bob: 1, carol: 1 })
      t.deepEqual(results[i++], { alice: 0, bob: 1, carol: 1 })
      t.deepEqual(results[i++], { alice: 0, bob: 1, carol: 2 })

      t.deepEqual(results[i++], { bob: 0, alice: 1, carol: 2 })
      t.deepEqual(results[i++], { bob: 0, alice: 1, carol: 1 })

      t.deepEqual(results[i++], { carol: 0, alice: 1, bob: 2 })
      t.deepEqual(results[i++], { carol: 0 })

      t.end()
      server.close()
    })
  })
})

tape('correctly delete edges', function (t) {

  var u = require('./util')

  var server = u.createDB('test-friends2', {
      port: 45451, host: 'localhost', timeout: 1000,
    }).use(require('../plugins/friends'))

  var api = server.api()

  var alice = createFeed(api, ssbKeys.generate(), ssbKeys)
  var bob   = createFeed(api, ssbKeys.generate(), ssbKeys)
  var carol = createFeed(api, ssbKeys.generate(), ssbKeys)

  cont.para([
    cont(schemas.addContact)(alice, bob.id,   { following: true, trust: 1 }),
    cont(schemas.addContact)(alice, carol.id, { following: true, trust: 0 }),
    cont(schemas.addContact)(bob, alice.id, { following: true,  trust: 1 }),
    cont(schemas.addContact)(bob, carol.id, { following: false, trust: -1 }),
    cont(schemas.addContact)(carol, alice.id, { following: true }),

    cont(schemas.addContact)(alice, carol.id, { following: false, trust: 0 }),
    cont(schemas.addContact)(alice, bob.id,   { following: true,  trust: 0 }),
    cont(schemas.addContact)(bob, carol.id, { following: false, trust: 0 })
  ]) (function () {

    cont.para([
      cont(api.friends.all)('follow'),
      cont(api.friends.all)('trust'),

      cont(api.friends.hops)({start: alice.id, graph: 'follow'}),
      cont(api.friends.hops)({start: alice.id, graph: 'trust'}),

      cont(api.friends.hops)({start: bob.id, graph: 'follow'}),
      cont(api.friends.hops)({start: bob.id, graph: 'trust'}),

      cont(api.friends.hops)({start: carol.id, graph:'follow'}),
      cont(api.friends.hops)({start: carol.id, graph: 'trust'})
    ], function (err, results) {

      var aliasMap = {}
      aliasMap[alice.id] = 'alice'
      aliasMap[bob.id]   = 'bob'
      aliasMap[carol.id] = 'carol'

      results = results.map(toAliases(aliasMap))
      var i = 0

      t.deepEqual(results[i++], { alice: { bob: true }, bob: { alice: true }, carol: { alice: true } })
      t.deepEqual(results[i++],  { alice: {}, bob: { alice: 1 }, carol: {} })

      t.deepEqual(results[i++], { alice: 0, bob: 1 })
      t.deepEqual(results[i++], { alice: 0 })

      t.deepEqual(results[i++], { bob: 0, alice: 1 })
      t.deepEqual(results[i++], { bob: 0, alice: 1 })

      t.deepEqual(results[i++], { carol: 0, alice: 1, bob: 2 })
      t.deepEqual(results[i++], { carol: 0 })

      t.end()
      server.close()
    })
  })
})

function toAliases(aliasMap) {
  return function (g) {
    var g_ = {}
    for (var k in g) {
      var k_ = aliasMap[k]
      if (typeof g[k] == 'object') {
        g_[k_] = {}
        for (var l in g[k]) {
          var l_ = aliasMap[l]
          g_[k_][l_] = g[k][l]
        }
      } else {
        g_[k_] = g[k]
      }
    }
    return g_
  }
}
