var Connect = require('./lib/connect/lib/connect'),
    redisLib = require("./lib/redis-node-client/lib/redis-client"),
    redis = redisLib.createClient(),
    http = require('http'),
    url = require('url');

function serveData(app){
    app.get('/data',function(request,response){
        redis.lindex('timeline',-1,function(err,key){
            var hash = String(key).split(':')[1];
            if(request.headers['if-none-match'] == hash){
                 console.log('served from cache');
                 response.writeHead(304, {'Content-Type': 'application/json'});
                 response.end();
            }
            else{
                redis.get(key,function(err,data){
                    var json = JSON.parse(data),
                        queryString = url.parse(request.url, true),
                        choice = (queryString.query && queryString.query.format == 'tree')?json.tree:json.flat,
                        result = JSON.stringify(choice);
                    response.writeHead(200, {'Content-Type': 'application/json; charset=utf-8','Etag': hash});
                    console.log('served fresh');
                    if (queryString.query && queryString.query.callback){
                        response.write(queryString.query.callback+'('+result+')');
                    }
                    else
                    {
                        response.write(result);
                    }
                    response.end();
                })   
            }
        });
    });
}

module.exports = Connect.createServer(
    Connect.logger(),
    Connect.responseTime(),
    Connect.router(serveData),
    Connect.staticProvider(__dirname + '/public'),
    Connect.conditionalGet(),
    Connect.cache(),
    Connect.gzip()
);
