var http = require('http');
XRegExp = require('./xregexp').XRegExp;
// var browser = require('./jsdom/lib/jsdom/browser');
// var dom = browser.browserAugmentation(require("../../lib/jsdom/level1/core").dom.level1.core);
// var sizzle = require('./sizzle').sizzle;

var small_pages = ["aylesbury.htm",
"barnstaple.htm",
"barrow-in-furness.htm",
"basildon.htm",
"birmingham.htm",
"blackfriars.htm"
];

var pages = ["aylesbury.htm",
"barnstaple.htm",
"barrow-in-furness.htm",
"basildon.htm",
"birmingham.htm",
"blackfriars.htm",
"bolton.htm",
"bournemouth.htm",
"bradford.htm",
"lewes.htm",
"bristol.htm",
"burnley.htm",
"bolton.htm",
"bury_st_edmunds.htm",
"caernarfon.htm",
"cambridge.htm",
"canterbury.htm",
"cardiff.htm",
"carlisle.htm",
"carmarthen.htm",
"centralcriminalcourt.htm",
"chelmsford.htm",
"chester.htm",
"chichester.htm",
"coventry.htm",
"croydon.htm",
"derby.htm",
"dolgellau.htm",
"doncaster.htm",
"dorchester.htm",
"durham.htm",
"exeter.htm",
"gloucester.htm",
"greatgrimsby.htm",
"guildford.htm",
"harrow.htm",
"haverfordwest.htm",
"hereford.htm",
"lewes.htm",
"peterborough.htm",
"innerlondon.htm",
"ipswich.htm",
"isleworth.htm",
"kings_lynn.htm",
"kingston-upon-hull.htm",
"kingston-upon-thames.htm",
"knutsford.htm",
"lancaster.htm",
"leeds.htm",
"leicester.htm",
"lewes.htm",
"lincoln.htm",
"liverpool.htm",
"luton.htm",
"maidstone.htm",
"manchestercrownsquare.htm",
"manchesterminshullst.htm",
"merthyrtydfil.htm",
"mold.htm",
"newcastle-upon-tyne.htm",
"newcastle-upon-tyne.htm",
"newport_crown_court.htm",
"newportiow.htm",
"northampton.htm",
"norwich.htm",
"nottingham.htm",
"oxford.htm",
"peterborough.htm",
"plymouth.htm",
"portsmouth.htm",
"preston.htm",
"preston.htm",
"reading.htm",
"salisbury.htm",
"sheffield.htm",
"shrewsbury.htm",
"snaresbrook.htm",
"southampton.htm",
"southend.htm",
"southwark.htm",
"stalbans.htm",
"stafford.htm",
"manchesterminshullst.htm",
"stoke-on-trent.htm",
"swansea.htm",
"swindon.htm",
"taunton.htm",
"teesside.htm",
"truro.htm",
"warrington.htm",
"warwick.htm",
"wolverhampton.htm",
"winchester.htm",
"wolverhampton.htm",
"woodgreen.htm",
"woolwich.htm",
"worcester.htm",
"york.htm"];

http.createServer(function (request, response) {
    var courts = http.createClient(80, 'www.hmcourts-service.gov.uk');
    var base_url = "/onlineservices/xhibit/";
    var data = [];
    var count=0;
    var case_closed=0;
    var courts_count = 0;
    response.writeHead(200, {'Content-Type': 'text/plain'});
    for (var i = 0;i<pages.length;i++){
        var page = pages[i];
        var courts_request = courts.request('GET', base_url+page,{'host': 'www.hmcourts-service.gov.uk'});
        courts_request.end();
        courts_request.addListener('response', function (courts_response) {
        var html;
        courts_response.addListener('data', function (chunk) {
            html += String(chunk);            
        });
        courts_response.addListener('end', function(){
             // response.write(html);
             matches=[];
             XRegExp.iterate(html, XRegExp('<td align="center">(?<row>.*)</td>',"mg"), function (match,index) {
                if (match.row.indexOf('Case Closed')!=-1){
                    case_closed = case_closed+1;
                }
                courts_count=courts_count+1;
                matches.push(match.row);
             });
             for (var r=0;r<matches.length;r=r+2){
                 // response.write(matches[r]+','+matches[r+1]+'\n');
             }
             count=count+1;
             if (count==pages.length){
                 response.write(String(case_closed)+'/'+String(courts_count)+'\n');
                 response.end();    
             }
        });
    });
};
}).listen(8124);

console.log('Server running at http://127.0.0.1:8124/');

