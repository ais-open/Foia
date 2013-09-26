// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232509
(function () {
    "use strict";

    var app = WinJS.Application;
    var activation = Windows.ApplicationModel.Activation;
    var messaging = Microsoft.WindowsAzure.Messaging;
    var pushNotifications = Windows.Networking.PushNotifications;

    var mobileSvcUrl = "<your mobile service url>";
    var mobileSvcSecret = "<your mobile service secret>";
    var foiaMobileServiceClient;
    var registrationTable;
    var requestTable;

    var toastTemplate = '<toast><visual><binding template="ToastText01"><text id="1">$(text1)</text></binding></visual></toast>';
    var serviceBusNamespace = "<your service bus namespace>";
    var hubSAS = "<your notification hub shared access secret>";
    var hubSAK = "<you notification hub shared access key>";
    var hubPath = "<your notification hub path>";
    var hub;

    var deviceId = "DevDevice";
    //var homePageUri = "ms-appx-web:///foiaHome.html";
    var homePageUri = "https://foiaonline.regulations.gov/foia/action/public/home";

    var channel;
    var webviewControl;
    var mainAppBar;

    app.onactivated = function (args) {
        if (args.detail.kind === activation.ActivationKind.launch) {
            if (args.detail.previousExecutionState !== activation.ApplicationExecutionState.terminated) {
                // TODO: This application has been newly launched. Initialize
                // your application here.
            } else {
                // TODO: This application has been reactivated from suspension.
                // Restore application state here.
            }
            args.setPromise(WinJS.UI.processAll());
            
            deviceId = Utility.getDeviceId();
            
            foiaMobileServiceClient = new WindowsAzure.MobileServiceClient(mobileSvcUrl, mobileSvcSecret);
            registrationTable = foiaMobileServiceClient.getTable("Registration");
            requestTable = foiaMobileServiceClient.getTable("Request");

            hub = new messaging.NotificationHub(serviceBusNamespace, hubSAK, hubPath);
            updateRegistration();
            
            webviewControl = document.getElementById("foiaWebview");
            mainAppBar = document.getElementById('mainAppBar').winControl;

            mainAppBar.getCommandById('cmdTweet').addEventListener("click", mainAppBar_onTweet, false);
            mainAppBar.getCommandById('cmdShare').addEventListener("click", mainAppBar_onShare, false);
            mainAppBar.getCommandById('cmdHome').addEventListener("click", mainAppBar_onHome, false);
            mainAppBar.getCommandById('cmdBack').addEventListener("click", mainAppBar_onBack, false);

            Windows.ApplicationModel.DataTransfer.DataTransferManager.getForCurrentView().addEventListener("datarequested", dataRequested);

            webviewControl.addEventListener("MSWebViewNavigationStarting", foiaWebview_onNavigationStarting, false);
            webviewControl.addEventListener("MSWebViewDOMContentLoaded", foiaWebview_onDOMContentLoaded, false);
            webviewControl.addEventListener("MSWebViewScriptNotify", foiaWebview_onScriptNotify, false);
            webviewControl.navigate(homePageUri);
        }
    };

    function mainAppBar_onTweet(eventArgs) {
        showProgressBar(true);
        var captureOperation = webviewControl.captureSelectedContentToDataPackageAsync();

        captureOperation.oncomplete = function (completeEvent) {
            var res = completeEvent.target.result;

            if (res) {
                var dataPackage = res.getView();

                dataPackage.getTextAsync().then(function (capturedText) {
                    loadTwitter(capturedText);
                });
            }
            else {
                loadTwitter("");
            }
        };

        captureOperation.start();
    }

    function loadTwitter(tweet) {
        var url = new Windows.Foundation.Uri("https://twitter.com/share?url=https://foiaonline.regulations.gov/foia/action/public/home&text=" + tweet);

        var options = new Windows.System.LauncherOptions();
        options.desiredRemainingView = Windows.UI.ViewManagement.ViewSizePreference.useMore;

        Windows.System.Launcher.launchUriAsync(url, options).then(function (data) {
            showProgressBar(false);
        });
    }

    function mainAppBar_onShare(eventArgs) {
        showProgressBar(true);
        Windows.ApplicationModel.DataTransfer.DataTransferManager.showShareUI();
        showProgressBar(false);
    }

    function mainAppBar_onHome(eventArgs) {
        webviewControl.navigate(homePageUri);
    }

    function mainAppBar_onBack(eventArgs) {
        if (webviewControl.canGoBack) {
            webviewControl.goBack();
        }
    }

    function dataRequested(eventArgs) {
        var dataPackage = eventArgs.request.data;
        
        dataPackage.properties.title = "My FOIA";
        dataPackage.properties.description = "Requests, Appeals and Records.";
        dataPackage.properties.applicationName = "My FOIA";
        dataPackage.setText(webviewControl.src);
        dataPackage.setWebLink(new Windows.Foundation.Uri(webviewControl.src)); 

        var captureOperation = webviewControl.capturePreviewToBlobAsync();
        captureOperation.oncomplete = function (completeEvent) {
            var bitmapStream = Windows.Storage.Streams.RandomAccessStreamReference.createFromStream(completeEvent.target.result.msDetachStream());
            dataPackage.setBitmap(bitmapStream);
        };
        
        captureOperation.start();
    }

    function foiaWebview_onNavigationStarting(eventArgs) {
        showProgressBar(true);
    }

    function foiaWebview_onDOMContentLoaded(eventArgs) {
        var isHomePage = (eventArgs.uri.toString().indexOf("action/public/home") != -1);
        var isSearchResultPage = (eventArgs.uri.toString().indexOf("runSearch") != -1);

        var script = "$('#usfoia').css('display', 'none');";

        if (isHomePage) {
            script += "var accountLink = $('#sliderRight').find(\"a[href$='/foia/action/public/account/']\").first();";
            script += "if(accountLink) {";
            script += "     accountLink.attr('href', '/foia/action/public/report');";
            script += "     accountLink.text('GENERATE REPORTS');";
            script += "} ";

            script += "var accountSlideImage = $('#slider').find(\"img[src$='slider_benefitsofaccount.jpg']\").first();";
            script += "if(accountSlideImage) {";
            script += "     var accountSlide = accountSlideImage.parent();";
            script += "     accountSlide.remove();";
            script += "}";
        }
        else if (isSearchResultPage) {
            script += "function populateCheckboxes(trackingNumberString) {";
            script += "    if(trackingNumberString == '') {";
            script += "        return;";
            script += "    }";
            script += "    var trackingNumberArray = trackingNumberString.split('|');";
            script += "    $.each($('.notifyCheckbox'), function (index, element) {";
            script += "        var elementNumber = $(element).attr('data-number');";
            script += "        for (var i = 0; i < trackingNumberArray.length; i++) {";
            script += "            if (trackingNumberArray[i] == elementNumber) {";
            script += "                $(element).attr('checked', 'checked');";
            script += "                break;";
            script += "            }";
            script += "        }";
            script += "    });";
            script += "}";

            script += "function notifyClick(checkboxControl) {";
            script += "var notifyData = '';";
            script += "if (checkboxControl.checked) {";
            script += "    notifyData = 'add';";
            script += "}";
            script += "else {";
            script += "    notifyData = 'delete';";
            script += "}";
            script += "window.external.notify(notifyData + '|' + ";
            script += " $(checkboxControl).attr('data-number') + '|' + ";
            script += " $(checkboxControl).attr('data-uri'));";
            script += "}";

            script += "var header = $('#curElem thead tr');";
            script += "$(header[0]).find('th:last').after('";
            script += " <th class=\"detail\">";
            script += " <a href=\"#\" onclick=\"return false\">Notify</a>";
            script += " </th>');";

            script += "var rows = $('#curElem tbody tr');";
            script += "for (var i = 0; i < rows.length; i++) {";
            script += "    var reqNumber = $(rows[i]).find('td:first a').text();";
            script += "    var reqUri = $(rows[i]).find('td:first a').attr('href');";
            script += "    reqUri = 'https://foiaonline.regulations.gov/foia/action/public/view/' + ";
            script += "     (reqUri.indexOf('request') != -1 ? \"request?\" : \"record?\") + ";
            script += "     reqUri.substring(reqUri.indexOf('objectId'));";
            script += "    $(rows[i]).find('td:last').after('";
            script += "     <td><input type=\"checkbox\" class=\"notifyCheckbox\" name=\"notify\" ";
            script += "     value=\"notify\" data-number=\"' + reqNumber + '\" data-uri=\"' + reqUri + '\" ";
            script += "     onclick=\"notifyClick(this);\" /></td>');";
            script += "}";
        }

        var scriptOperation = webviewControl.invokeScriptAsync("eval", new Array(script));

        scriptOperation.oncomplete = function (e) {
            if (isSearchResultPage) {
                requestTable.where({ DeviceId: deviceId }).read().done(function (requests) {
                    var scriptOperation2 = webviewControl.invokeScriptAsync("populateCheckboxes", getTrackingNumbersAsString(requests));

                    scriptOperation2.oncomplete = function (e) {
                        showProgressBar(false);
                    }

                    scriptOperation2.start();
                });
            }
            else {
                showProgressBar(false);
            }
        }
        scriptOperation.start();
    }

    function foiaWebview_onScriptNotify(eventArgs) {
        showProgressBar(true);

        var scriptNotifyDataArr = eventArgs.value.split("|");
        var operation = scriptNotifyDataArr[0];
        var reqNumber = scriptNotifyDataArr[1];
        var reqUri = scriptNotifyDataArr[2];

        var requestTable = foiaMobileServiceClient.getTable("Request");

        var tablePromise;

        if (operation == "add") {
            requestTable.insert({
                DeviceId: deviceId,
                TrackingNumber: reqNumber,
                RequestUri: reqUri
            }).done(function () {
                updateRegistration();
            });
        }
        else {
            requestTable.where({
                DeviceId: deviceId,
                TrackingNumber: reqNumber,
                RequestUri: reqUri
            }).read().done(function (requests){
                if (requests.length > 0) {
                    requestTable.del({
                        id: requests[0].id
                    }).done(function () {
                        updateRegistration();
                    });
                }
            });
        }
    }

    function updateRegistration() {
        var channelOperation = pushNotifications.PushNotificationChannelManager.createPushNotificationChannelForApplicationAsync();

        channelOperation.then(function (newChannel) {
            channel = newChannel.uri;
            return requestTable.where({ DeviceId: deviceId }).read();
        }).then(function (requests) {
            if (requests.length > 0) {
                var trackingNumArray = getTrackingNumbers(requests);
                //return hub.registerTemplateForApplicationAsync(channel, 'foiaToast', trackingNumArray, { 'X-WNS-Type': 'wns/toast' }, toastTemplate);
                return hub.registerApplicationAsync(channel, trackingNumArray);
            }
            else {
                //return hub.unregisterTemplateForApplicationAsync('foiaToast');
                return hub.unregisterApplicationAsync();
            }
        }).done(function () {
            showProgressBar(false);
        });
    }

    function getTrackingNumbers(requests) {
        var trackingNumArr = new Array();

        for (var i = 0; i < requests.length; i++) {
            trackingNumArr[i] = requests[i].TrackingNumber;
        }

        return trackingNumArr;
    }

    function getTrackingNumbersAsString(requests) {
        var trackingNumArr = getTrackingNumbers(requests);

        if (trackingNumArr.length > 0) {
            return trackingNumArr.join("|");
        }
        else {
            return "";
        }
    }

    function showProgressBar(show) {
        if (show) {
            document.getElementById("progressBar").style.display = "block";
        }
        else {
            document.getElementById("progressBar").style.display = "none";
        }
    }

    app.start();
})();
