var sys = require("sys"), 
    http = require('http'),
    dom = require("./lib/jsdom/lib/jsdom/level1/core").dom.level1.core,
    htmlparser = require("./lib/node-htmlparser"),
    doc =  require("./lib/jsdom/lib/jsdom/browser").windowAugmentation(dom, {parser: htmlparser}).document,
    sizzle = require('./lib/jsdom/example/sizzle/sizzle').sizzleInit({}, doc),
    crypto = require('crypto');

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

function getHearings(callback){
    console.log('getting hearings from '+pages.length+' pages');
    var count=0;
    var data = [];  
    for (var i = 0;i<pages.length;i++){
        getHTML(pages[i],function(html){       
                doc.innerHTML = html;
                count=count+1;
                sys.puts(count);
                var rows = sizzle('div#content tr');
                var court = cleanSingleCell(sizzle('div#content h2')[0]);
                var updated = cleanSingleCell(sizzle('div#content p')[0]);
                for(var i=0; i< rows.length; i++){
                    var cells = sizzle('td',rows[i]);
                    if (cells.length>0){
                        data.push({
                                      Court            : court,
                                      Updated          : updated,
                                      CourtNumber      : cleanSingleCell(cells[0]),
                                      CaseNumber       : cleanMultipleCell(cells[1]),
                                      Name             : cleanMultipleCell(cells[2]),
                                      CurrentStatus    : cleanMultipleCell(cells[3])
                                  });
                    };
                 };
                 if (count==pages.length){
                      var json = JSON.stringify({
                                                    scraped : new Date(),
                                                    count   : data.length,
                                                    hash    : crypto.createHash('md5').update(String(data)).digest('hex'),
                                                    results : data
                                                  },null,'\t');
                      cache = {
                                    json:    json,
                                    hash:    crypto.createHash('md5').update(json).digest('hex')
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
         response.writeHead(304, {'Content-Type': 'application/json'});
         response.end();
    }
    else{
        response.writeHead(200, {'Content-Type': 'application/json; charset=utf-8','Etag': cache.hash});
        response.write(cache.json);
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

