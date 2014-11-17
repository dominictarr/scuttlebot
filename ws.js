var ws = require('pull-ws')
var WebSocket = require('ws')
var url = require('url')

exports.connect = function (addr) {
  var u = url.format({
    protocol: 'ws', slashes: true,
    hostname: addr.host,
    port: addr.port
  })
  return ws(new WebSocket(u))
}

var EventEmitter = require('events').EventEmitter

exports.createServer = function (onConnection) {
  var emitter = new EventEmitter()
  var server
  if(onConnection)
    emitter.on('connection', onConnection)

  emitter.listen = function (addr, onListening) {
    if(onListening)
      emitter.once('listening', onListening)

    server = new WebSocket.Server({port: addr.port || addr})
      .on('listening', function () {
        emitter.emit('listening')
      })
      .on('connection', function (socket) {
        emitter.emit('connection', ws(socket))
      })
    return emitter
  }
  emitter.close = function (onClose) {
    if(!server) return onClose()
    server.close(onClose)
    return emitter
  }
  return emitter
}