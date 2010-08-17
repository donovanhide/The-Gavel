#!/usr/bin/env node
  
var sys = require("sys"),
    http = require('http'),
    dns = require('dns'),
    redisLib = require("./lib/redis-node-client/lib/redis-client"),
    redis = redisLib.createClient(),
    dom = require("./lib/jsdom/lib/jsdom/level1/core").dom.level1.core,
    htmlparser = require("./lib/node-htmlparser"),
    doc =  require("./lib/jsdom/lib/jsdom/browser").windowAugmentation(dom, {parser: htmlparser}).document,
    sizzle = require('./lib/jsdom/example/sizzle/sizzle').sizzleInit({}, doc),
    crypto = require('crypto'),
    linq = require('./lib/linq');

require('./lib/underscore');

function isEmptyString(string){
    return string!='';
};

function stripWhitespace(string){
    return string.replace(/^\s+|\s+$/g,'');
};

function stripHTML(string){
    return string.replace(/<.*?>/g,'');
};

function cleanMultipleCell(cell){
     return cell.text.split(/<br>|-/).map(stripHTML).map(stripWhitespace).filter(isEmptyString);
};

function cleanSingleCell(cell){
     return stripHTML(stripWhitespace(cell.text));
};

function setDom(html){
    try{
         doc.innerHTML = html;   
    }
    catch(err){
           console.log(err.description+'\nWith: '+html)
    }
}

function getHTML(host,path,callback){
    var client = http.createClient(80, host),
        url = host+path,
        httpCache = 'cache:'+url,
        html="";
    redis.hgetall(httpCache,function(err,cache){
        redisLib.convertMultiBulkBuffersToUTF8Strings(cache);
        var headers = {'host': host,'If-None-Match':cache?cache.etag:null},
            request = client.request('GET',path,headers);
        request.end();
        request.addListener('response',function(response){
            response.addListener('data', function (chunk) {
                html += String(chunk);            
            });
            response.addListener('end',function(){
                var etag = response.headers['etag'];
                if (response.statusCode == 304){
                    callback(cache.response,cache.etag);
                }
                else if (response.statusCode == 200){
                    redis.hmset(httpCache,'response',html,'etag',etag,function(err,value){
                        callback(html,etag);  
                    })
                }
                else{
                    console.log ('Error getting html for '+url+'\nResponse Code:'+response.statusCode+'\nResults: '+html)
                    callback(null,null);
                }
                
            })
        })
    })
}

//Yuck! JSON Transform Language required!
function treeify(data){
     return   _(data).chain()
                     .pluck('area').uniq()
                     .map(function(area){
                        return{
                                area      : area,
                                locations : _(data).chain()
                                                   .filter(function(item){
                                                        return item.area == area;
                                                    })
                                                    .pluck('location').uniq()
                                                    .map(function(location){
                                                        return{
                                                            location : location,
                                                            courts   : _(data).chain()
                                                                              .filter(function(item){
                                                                                  return item.location == location;
                                                                              })
                                                                              .map(function(court){
                                                                                  return {
                                                                                            court           : court.court,
                                                                                            caseNumber      : court.caseNumber,
                                                                                            name            : court.name,
                                                                                            currentStatus   : court.currentStatus,
                                                                                            updated         : court.updated
                                                                                  }
                                                                              })
                                                                              .value()
                                                        } 
                                                    })
                                                    .value()
                                                        
                                    }
                        }).value()
}

function publishData(data,etags){
      //hash only changes when an etag changes - beautiful!!!
      var hash = crypto.createHash('md5').update(etags.sort().join()).digest('hex'),
          updated = new Date(_(data).chain().pluck('updated').max().value()),
          key = 'data:'+hash+':'+updated.getTime(),
          clean_data = Enumerable.From(data)
                                 .Distinct("$.location+$.court")
                                 .OrderBy("$.area")
                                 .ThenBy("$.location")
                                 .ToArray(),
          json = JSON.stringify({
                                    flat: {
                                            updated : updated,
                                            count   : clean_data.length,
                                            hash    : hash,
                                            results : clean_data
                                          },
                                    tree:{
                                            updated : updated,
                                            count   : clean_data.length,
                                            hash    : hash,
                                            results : treeify(clean_data)
                                         }
                                 },null,'\t');   
        console.log("Stored "+clean_data.length+" courts from "+data.length+" lines");
        redis.setnx(key,json,function(err,value){
            if (value){
                            redis.rpush('timeline',key,function(err,reply){
                                    redis.publish('next',key,function(err,reply){
                                            console.log('Published '+key+' to '+(reply === 0 ? "no one" : (reply + " subscriber(s).")));   
                                     });
                            });
            }
            else{
                console.log(key+' already exists.');
            }
        });                 
};

function scrapeCourtList(ip_address,callback){
    var court_list = getHTML(ip_address,'/xhibit/court_lists.htm',function(html,etag){
        console.log('getting courts');
        setDom(html);
        var links = sizzle('div#content a[href$=htm]:not(a[href^=..])');
        var pages = _(links).chain().pluck('href').uniq().value();
        callback(pages)
    });
}

function scrapeCourt(ip_address){
    scrapeCourtList(ip_address,function(pages){
        console.log('getting hearings from '+pages.length+' courts');
        var count=0,
            data = [],
            etags = [];  
        _(pages).each(function(page){
            getHTML(ip_address,'/onlineservices/xhibit/'+page,function(html,etag){      
                    setDom(html);
                    etags.push(etag);
                    count=count+1;
                    try{
                        var updated = cleanSingleCell(sizzle('div#content p')[0]);
                        var areas = sizzle('div#content h2');
                        var area = cleanSingleCell(areas[0]);
                        console.log(area);
                        for (var r=0; r< areas.length;r++){
                            var location = cleanSingleCell(areas[r]);
                            console.log('\t'+location);
                            var nearest_table = sizzle('~table',areas[r]);
                            var rows = sizzle('tr',nearest_table[0]);
                            for(var i=0; i< rows.length; i++){
                                 var cells = sizzle('td',rows[i]);
                                    if (cells.length>0){
                                          data.push({
                                                          area             : area,
                                                          location         : location,
                                                          court            : cleanSingleCell(cells[0]),
                                                          caseNumber       : cleanMultipleCell(cells[1]),
                                                          name             : cleanMultipleCell(cells[2]),
                                                          currentStatus    : cleanMultipleCell(cells[3]),
                                                          updated          : new Date(Date.parse(updated))
                                                      });
                                    };
                                 };
                            }
                     }
                     catch(err){
                            console.log(err.description+'\nOn: '+page)
                     }
                     if (count==pages.length){
                        publishData(data,etags);
                      };
                 });
          });
    });
}

var ONE_MINUTE = 1000*60;
var FIVE_SECONDS = 1000*5;

dns.lookup('www.hmcourts-service.gov.uk',function(err,address){
    if(err){
        console.log('Could not resolve IP address');
    }
    else{
        console.log('Resolved IP address: '+address);
        setInterval(scrapeCourt,ONE_MINUTE,address);
        scrapeCourt(address);  
    }
})
