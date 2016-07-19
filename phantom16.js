/* STANDALONE PHANTOMJS FILE
TO RUN, INSTALL PHANTOMJS AND RUN IN CONSOLE: PHANTOMJS PHANTOM16.js
http://phantomjs.org/
*/

// initialize variables needed across functions
var page = require('webpage').create(),
    system = require('system'),
    fs = require('fs'),
    //list of sample URLs to check
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
//console messages on headless browser are displayed on your console
page.onConsoleMessage = function(msg) {
    system.stderr.writeLine('console: ' + msg);
};
//if error, console error and go to next URL
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
    pageTimers = [setTimeout(nextUrl, 30000)];
};
//console log new URL to be processed
page.onUrlChanged = function(targetUrl) {
    if(!(/about:blank/).test(targetUrl)) console.log('A CHALLENGER APPEARS: ' + targetUrl);
};
//if a new page is created (not supposed to happen)
page.onPageCreated = function(newPage) {
    console.log('A wild page appeared!');
};

// make a note of any errors so we can print them out
page.onResourceError = function(resourceError) {
    page.error = JSON.stringify(resourceError);
};
// called every time a resource is requested- important for detecting adobe analytics calls
page.onResourceRequested = function(requestData, networkRequest) {
    // loop through resourcesToLog to see if URL of request matches any of them
    var length = resourcesToLog.length;
    while (length--) {
        //a string that includes the current URL and javascript files
        var preRegEx = (currUrl ? '^' + currUrl + (currUrl.slice(-4) == "html" ? "$|api\.demandbase|assets\.adobedtm\.com|ooyala|\.js$" : (currUrl.slice(-1) == '/' ? '$|api\.demandbase|assets\.adobedtm\.com|ooyala|\.js$' : '/$|api\.demandbase|assets\.adobedtm\.com|ooyala|\.js$')) : "\.js$");
        //regex of above string
        var addressRegex = new RegExp(preRegEx);
        //only allow requests to adobe analytics
        if (resourcesToLog[length].test(requestData.url) || (/servicenowinc\.d2\.sc\.omtrdc\.net/).test(requestData.url)) {
            var match = (requestData.url).match(/.+\?(.+)/)[1];
            var matchArr = match.split('&');
            var tempValue = '';
            matchArr.forEach(function(e) {
                var key = e.match(/(.+)=(.+)/)[1];
                var value = decodeURIComponent(e.match(/(.+)=(.+)/)[2]);
                //prop8 is the traffic variable that holds the href of a link clicked
                if ((/^c8/).test(key)) {
                    tempValue = value;
                }
                //eVar22 is the conversion variable that holds the link click value for reporting
                if ((/^v22/).test(key)) {
                    console.log('link #', m + 1);
                    console.log(key, 'is', value);

                    if (tempValue) urlEvars.push(tempValue);
                    tempValue = undefined;
                    m++;
                    removeTimers();
                    pageTimers = [setTimeout(nextUrl, 20000)];
                }
            });
        } 
        //abort request if the request is not adobe analytics, current URL, or javascript
        else if (!(addressRegex).test(requestData.url)) {
            removeTimers();
            pageTimers = [setTimeout(nextUrl, 20000)];
            networkRequest.abort();
        } 
        //if it matches regex, allow but reset timeouts
        else {
            removeTimers();
            pageTimers = [setTimeout(nextUrl, 20000)];
        }
    }
};
//function to remove all setTimeouts
//using array of setTimeouts bc otherwise hard to remove multiple timeouts
function removeTimers() {
    for (var y = 0; y < pageTimers.length; y++) {
        clearTimeout(pageTimers[y]);
    }
}
//process the passed URL
function handleUrl(theUrl) {
    m = 0;
    removeTimers();
    //use phantom to open the page
    page.open(theUrl, function(status) {
        if (status !== 'success') {
            removeTimers();
            console.log("FAILED: to load " + theUrl);
            console.log(page.error);
        } 
        else {
            console.log('Wild', currUrl, 'appeared!');

            //evaluate the page to click and process all links
            page.evaluate(function(theUrl) {
                //all links with href on page
                linksToClick = document.querySelectorAll('a[href]');
                console.log('Gotta Catch \'Em All:', linksToClick.length);

                for (var i = 0; i < linksToClick.length; i++) {
                    linksToClick[i].onclick = function() {
                        //prevent new pages from loading from link click
                        event.preventDefault();
                        event.stopPropagation();
                        //must have an equivalent method available on your page via DTM
                        //processTic is custom middleware that sets the relevant variables and then invokes s.tl() with the data
                        _A.core.processTic(event);
                    }
                }
            }, theUrl);

            //initialize qaResults key to all the anchors with href
            qaResults[theUrl] = page.evaluate(function(){
                var temp = [];
                // var array = document.querySelectorAll('a[href]')
                for (var i = 0; i < linksToClick.length; i++) {
                    temp.push(linksToClick[i].getAttribute('href'))
                }
                return temp;
            })
            //if the page loaded but there are no hrefs, the value will hold "PAGE IS BROKEN"
            if(qaResults[theUrl].length === 0) qaResults[theUrl] = ["PAGE IS BROKEN"]

            //click all the href links
            page.evaluate(function() {
                for (var i = 0; i < linksToClick.length; i++) {
                    //not clicking all links right away because there are too many requests, bad things happen
                    setTimeout(linksToClick[i].click(), 1000);
                }
            })
        }
    });
};
//function to check and handle next URL
function nextUrl() {
    removeTimers();
    //remove all good/passing link clicks from qaResults
    if(urlEvars.length && qaResults[currUrl].length) {
        for(var i = urlEvars.length-1; i >= 0; i--) {
            for(var j = qaResults[currUrl].length-1; j >= 0; j--){
                if((new RegExp(urlEvars[i].replace('?', ''))).test(qaResults[currUrl][j].replace('?', ''))){
                    qaResults[currUrl].splice(j, 1);
                    break;
                }
            }
        }
    }
    console.log('\n\nURL EVARS', urlEvars.length, '\n')
    //sets next URL on urls object to true
    //sets currUrl to current URL to process
    for (var k = 0; k < urlList.length; k++) {
        if (urls[urlList[k]]) {
            currUrl = urlList[k];
            urls[urlList[k]] = false;
            if (urlList[k + 1]) urls[urlList[k + 1]] = true;
            break;
        } 
        else currUrl = undefined;
    }
    //if no currURL (i.e. at the end) then end
    if (!currUrl) {
        console.log('All your pokemon have fainted. You black out!');
        console.log('Results', JSON.stringify(qaResults));
        var resultKeys = Object.keys(qaResults);
        var toWrite = "";
        resultKeys.forEach(function(e){
            toWrite += qaResults[e].length === 0 ? '***** ' + e.toUpperCase() + ' *****' + '\nthere were no issues!!' + '\n\n' : '***** ' + e.toUpperCase() + ' *****' + '\nnumber of issues: ' + qaResults[e].length + '\ncheck links:\n' + qaResults[e].join('\n') +'\n\n'
        })
        //write results to output.txt
        fs.write('output.txt', toWrite, 'w');
        //need to exit else phantom will run perpetually
        phantom.exit();
    } 
    else {
        //reset the links to check on the page
        linksToClick = undefined;
        urlEvars = [];
        //process current URL right away and set up next URL just in case
        pageTimers = [setTimeout(nextUrl, 20000)];
        pageTimers = [setTimeout(function(){handleUrl(currUrl, qaResults)}, 0)];
    }
}

//initialize qaResults and urlList
for (var j = 0; j < theList.length; j++) {
    urls[theList[j]] = (j === 0 ? true : false);
    qaResults[theList[j]] = [];
}
var urlList = Object.keys(urls);

console.log('Analytics QA wants to battle!');
//start the process
nextUrl();