
var cont = require('cont')

function each(obj, iter) {
  for(var k in obj)
    iter(obj[k], k)
}

function map(obj, iter) {
  var o = {}
  each(obj, function (v, k) {
    o[k] = iter(v, k)
  })
  return o
}

var manifest = {
  'add'             : 'async',
  'get'             : 'async',
  'getPublicKey'    : 'async',
  'getLatest'       : 'async',
  'relatedMessages' : 'async',


  'createFeedStream'       : 'source',
  'createHistoryStream'    : 'source',
  'createLogStream'        : 'source',
  'messagesByType'         : 'source',
  'messagesLinkedToMessage': 'source',
  'messagesLinkedToFeed'   : 'source',
  'messagesLinkedFromFeed' : 'source',
  'feedsLinkedToFeed'      : 'source',
  'feedsLinkedFromFeed'    : 'source',
//  'createReadStream'       : 'source',
}

module.exports = function (ssb) {
  return {
    name: 'ssb',
    version: '1.0.0',
    core: true,
    manifest: manifest,
    api: map(manifest, function (type, name) {
      if('function' !== typeof ssb[name])
        throw new Error(name + ' is not a function')
      return (
        type === 'async'
        ? cont(function (val, cb) {
          return ssb[name](val, cb)
        })
        : function (val) {
          return ssb[name](val)
        }
      )
    })
  }
}
