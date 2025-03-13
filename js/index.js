$(document).ready(function () {
    $("#homeOpen").click(function () {
        const postmanUrl = chrome.runtime.getURL("big_curl.html") + "?t=" + new Date().getTime();
        chrome.tabs.create({url: postmanUrl});
    });
});