var sys = require("sys"), 
    http = require('http'),
    dom = require("./lib/jsdom/lib/jsdom/level1/core").dom.level1.core,
    htmlparser = require("./lib/node-htmlparser"),
    doc =  require("./lib/jsdom/lib/jsdom/browser").windowAugmentation(dom, {parser: htmlparser}).document,
    sizzle = require('./lib/jsdom/example/sizzle/sizzle').sizzleInit({}, doc),
    crypto = require('crypto'),
    url = require('url');

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

function getHTML(url_fragment,callback){
    request = client.request('GET','/onlineservices/xhibit/'+url_fragment,{'host': 'www.hmcourts-service.gov.uk'});
    request.end();
    var html;
    request.addListener('response',function(response){
        response.addListener('data', function (chunk) {
            html += String(chunk);            
        });
        response.addListener('end',function(){
            callback(html);
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

function getHearings(callback){
    console.log('getting hearings from '+pages.length+' pages');
    var count=0;
    var data = [];  
    for (var p = 0;p<pages.length;p++){
        getHTML(pages[p],function(html){      
                sys.puts(count);
                doc.innerHTML = html;
                count=count+1;
                try{
                    var updated = cleanSingleCell(sizzle('div#content p')[0]);
                    var areas = sizzle('div#content h2');
                    var area = cleanSingleCell(areas[0]);
                    for (var r=0; r< areas.length;r++){
                        if (r>0 && areas[r]==areas[0]){
                            break;
                        }
                        var location = cleanSingleCell(areas[r]);
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
                                                      updated          : updated
                                                  });
                                };
                             };
                        }
                 }
                 catch(err){
                        console.log(err.description+'\nOn: '+pages[p])
                 }
                   
                 if (count==pages.length){
                      var hash = crypto.createHash('md5').update(String(data)).digest('hex');
                      var scraped = new Date();
                      var flat = JSON.stringify({
                                                    scraped : scraped,
                                                    count   : data.length,
                                                    hash    : hash,
                                                    results : data
                                                  },null,'\t');
                      var tree = JSON.stringify({
                                                    scraped : scraped,
                                                    count   : data.length,
                                                    hash    : hash,
                                                    results : treeify(data)
                                                  },null,'\t');
                      cache = {
                                    flat    : flat,
                                    tree    : tree,
                                    hash    : crypto.createHash('md5').update(flat).digest('hex')
                                };
                      console.log('cache (re)created with hash: '+cache.hash);
                      setTimeout(getHearings,60*1000);
                      if (callback){
                          callback()
                      }
                  };
             });
         };
}

function servePages(request, response) {
    if(request.headers['if-none-match'] == cache.hash){
         console.log('served from cache');
         response.writeHead(304, {'Content-Type': 'application/json'});
         response.end();
    }
    else{
        response.writeHead(200, {'Content-Type': 'application/json; charset=utf-8','Etag': cache.hash});
        console.log('served fresh');
        var queryString = url.parse(request.url, true);
        var result = (queryString.query && queryString.query.format == 'tree')?cache.tree:cache.flat;
        if (queryString.query && queryString.query.callback){
            response.write(queryString.query.callback+'('+result+')');
        }
        else
        {
            response.write(result);
        }
        response.end();
    }    
}


var client = http.createClient(80, 'www.hmcourts-service.gov.uk');
var pages = [];
var cache = {};

getHTML('court_lists.htm',function(html){
    console.log('getting courts');
    doc.innerHTML = html;
    var links = sizzle('div#content a[href$=htm]:not(a[href^=..])');
    for (var i=0;i<links.length;i++){
        pages.push(links[i].href);  
    }
    pages = _.uniq(pages);
    getHearings(function(){
        http.createServer(servePages).listen(8124);
        console.log('Server running on port 8124'); 
    });  
})

