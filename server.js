require.paths.push('./lib');

var connect = require('connect'),
    redisLib = require("redis-client"),
    http = require('http'),
    url = require('url');

function sendData(request,response,key){
    var hash = String(key).split(':')[1];
    if(request.headers['if-none-match'] == hash){
         response.writeHead(304, {'Content-Type': 'application/json'});
         response.end();
    }
    else{
        var redis = redisLib.createClient();
        redis.get(key,function(err,data){
            var json = JSON.parse(data),
                queryString = url.parse(request.url, true),
                choice = (queryString.query && queryString.query.format == 'tree')?json.tree:json.flat,
                result = JSON.stringify(choice);
            response.writeHead(200, {'Content-Type': 'application/json; charset=utf-8','Etag': hash});
            if (queryString.query && queryString.query.callback){
                response.write(queryString.query.callback+'('+result+')');
            }
            else
            {
                response.write(result);
            }
            redis.close();
            response.end();
        })   
    }
}

function serveData(app){
    app.get('/data',function(request,response){
        var redis = redisLib.createClient();
        redis.lindex('timeline',-1,function(err,key){
            redis.close();
            sendData(request,response,key)
        });
    });
    app.get('/next',function(request,response){
        var redis = redisLib.createClient();
        redis.subscribeTo('next',function(err,key){
            redis.unsubscribeFrom('next');
            redis.close();
            sendData(request,response,key);
        })
        request.connection.on('timeout',function(){
            redis.unsubscribeFrom('next');
            redis.close();
        })
    })
}

module.exports = connect.createServer(
    connect.logger(),
    connect.router(serveData),
    connect.conditionalGet(),
    connect.staticProvider(__dirname + '/public'),
    connect.cache(),
    connect.gzip()
);
