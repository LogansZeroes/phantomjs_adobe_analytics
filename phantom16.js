/*
Made by Logan Rado
Made for viewers like you
*/

// initialize variables needed across functions
var page = require('webpage').create(),
    system = require('system'),
    fs = require('fs'),
    theList = fs.read('simple.txt').split('\n'),
    urls = {},
    linksToClick = undefined,
    currUrl,
    pageTimers = [],
    requestMap = {},
    //to filter for only analytics requests
    //add other analytics filters like GA as desired
    resourcesToLog = [new RegExp('\/b\/ss\/')],
    m,
    qaResults = {},
    urlEvars = [];

page.onConsoleMessage = function(msg) {
    system.stderr.writeLine('console: ' + msg);
};

page.onError = function(msg, trace) {
    removeTimers();
    var msgStack = ['ERROR: ' + msg];
    if (trace && trace.length) {
        msgStack.push('TRACE:');
        trace.forEach(function(t) {
            msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function+'")' : ''));
        });
    }
    console.error(msgStack.join('\n'));
    // setTimeout(function(){handleUrl(currUrl)}, 10000);
    // handleUrl(currUrl);
    pageTimers = [setTimeout(nextUrl, 30000)];
};

page.onUrlChanged = function(targetUrl) {
    if(!(/about:blank/).test(targetUrl)) console.log('A CHALLENGER APPEARS: ' + targetUrl);
};

page.onPageCreated = function(newPage) {
    console.log('A wild child page appeared!');
};

// make a note of any errors so we can print them out
page.onResourceError = function(resourceError) {
    page.error = JSON.stringify(resourceError);
};
// called every time a resource is requested- important for detecting adobe analytics calls
page.onResourceRequested = function(requestData, networkRequest) {
    // loop through resourcesToLog to see if this url matches any of them
    var length = resourcesToLog.length;
    while (length--) {
        var preRegEx = (currUrl ? '^' + currUrl + (currUrl.slice(-4) == "html" ? "$|api\.demandbase|assets\.adobedtm\.com|ooyala|\.js$" : (currUrl.slice(-1) == '/' ? '$|api\.demandbase|assets\.adobedtm\.com|ooyala|\.js$' : '/$|api\.demandbase|assets\.adobedtm\.com|ooyala|\.js$')) : "\.js$");
        var addressRegex = new RegExp(preRegEx);
        if (resourcesToLog[length].test(requestData.url) || (/servicenowinc\.d2\.sc\.omtrdc\.net/).test(requestData.url)) {
            var match = (requestData.url).match(/.+\?(.+)/)[1];
            var matchArr = match.split('&');
            var tempValue = '';
            matchArr.forEach(function(e) {
                var key = e.match(/(.+)=(.+)/)[1];
                var value = decodeURIComponent(e.match(/(.+)=(.+)/)[2]);
                if ((/^c8/).test(key)) {
                    tempValue = value;
                }
                if ((/^v22/).test(key)) {
                    // setTimeout(console.log('link #', m + 1), 1000)
                    // setTimeout(console.log(key, 'is', value), 1000)
                    console.log('link #', m + 1);
                    console.log(key, 'is', value);

                    if (tempValue) urlEvars.push(tempValue);
                    tempValue = undefined;
                    m++;
                    removeTimers();
                    pageTimers = [setTimeout(nextUrl, 20000)];
                }
            });
        } else if (!(addressRegex).test(requestData.url)) {
            removeTimers();
            pageTimers = [setTimeout(nextUrl, 20000)];
            networkRequest.abort();
        } else {
            removeTimers();
            pageTimers = [setTimeout(nextUrl, 20000)];
        }
    }
};

function removeTimers() {
    for (var y = 0; y < pageTimers.length; y++) {
        clearTimeout(pageTimers[y]);
    }
}

function handleUrl(theUrl) {
    m = 0;
    removeTimers();
    page.open(theUrl, function(status) {
        if (status !== 'success') {
            removeTimers();
            console.log("FAILED: to load " + theUrl);
            console.log(page.error);
        } else {
            console.log('Wild', currUrl, 'appeared!');

            page.evaluate(function(theUrl) {
                linksToClick = document.querySelectorAll('a[href]');
                console.log('Gotta Catch \'Em All:', linksToClick.length);

                for (var i = 0; i < linksToClick.length; i++) {
                    linksToClick[i].onclick = function() {
                        event.preventDefault();
                        event.stopPropagation();
                        //must have an equivalent method available on your page via DTM
                        //processTic is custom middleware that sets the relevant variables and then invokes s.tl() with the data
                        _A.core.processTic(event);
                    }
                }
                
            }, theUrl);
            // page.evaluate(function() {
            //     for (var i = 0; i < linksToClick.length; i++) {
            //         // linksToClick[i].click();
            //         setTimeout(linksToClick[i].click(), 1000);
            //     }
            // })

            qaResults[theUrl] = page.evaluate(function(){
                var temp = [];
                // var array = document.querySelectorAll('a[href]')
                for (var i = 0; i < linksToClick.length; i++) {
                    temp.push(linksToClick[i].getAttribute('href'))
                    // if(i == array.length/2) temp.push('MONKEYS')
                    // if(i == 0) temp.push('FIRST MONKEY')
                }
                // temp.push('LAST MONKEY');
                // temp.push('OOH OOH AH');
                return temp;
            })
            if(qaResults[theUrl].length === 0) qaResults[theUrl] = ["PAGE IS BROKEN"]
            

            page.evaluate(function() {
                for (var i = 0; i < linksToClick.length; i++) {
                    // linksToClick[i].click();
                    setTimeout(linksToClick[i].click(), 1000);
                }
            })
        }
    });
};

function addToResults(url, link) {
    qaResults[url][link] = false;
}

function nextUrl() {
    removeTimers();
    if(urlEvars.length && qaResults[currUrl].length) {
        for(var i = urlEvars.length-1; i >= 0; i--) {
            for(var j = qaResults[currUrl].length-1; j >= 0; j--){
                if((new RegExp(urlEvars[i].replace('?', ''))).test(qaResults[currUrl][j].replace('?', ''))){
                    // qaResults[currUrl].splice(j, 1, "");
                    qaResults[currUrl].splice(j, 1);
                    break;
                }
            }
        }
    }
    console.log('\n\nURL EVARS', urlEvars.length, '\n')
    for (var k = 0; k < urlList.length; k++) {
        if (urls[urlList[k]]) {
            currUrl = urlList[k];
            urls[urlList[k]] = false;
            if (urlList[k + 1]) urls[urlList[k + 1]] = true;
            break;
        } else currUrl = undefined;
    }
    if (!currUrl) {
        console.log('All your pokemon have fainted. You black out!');
        console.log('Results', JSON.stringify(qaResults));
        // console.log('url evars', urlEvars.toString())
        var resultKeys = Object.keys(qaResults);
        var toWrite = "";
        resultKeys.forEach(function(e){
            toWrite += qaResults[e].length === 0 ? '***** ' + e.toUpperCase() + ' *****' + '\nthere were no issues!!' + '\n\n' : '***** ' + e.toUpperCase() + ' *****' + '\nnumber of issues: ' + qaResults[e].length + '\ncheck links:\n' + qaResults[e].join('\n') +'\n\n'
        })
        fs.write('output.txt', toWrite, 'w')
        phantom.exit();
    } else {
        linksToClick = undefined;
        urlEvars = [];
        pageTimers = [setTimeout(nextUrl, 20000)];
        pageTimers = [setTimeout(function(){handleUrl(currUrl, qaResults)}, 0)];
        // handleUrl(currUrl, qaResults);
    }
}

//initialize qaResults and urlList
for (var j = 0; j < theList.length; j++) {
    urls[theList[j]] = (j === 0 ? true : false);
    qaResults[theList[j]] = [];
}
var urlList = Object.keys(urls);

console.log('Analytics QA wants to battle!');
nextUrl();