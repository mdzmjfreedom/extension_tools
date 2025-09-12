$(document).ready(function () {
    $("#curl").click(function () {
        const postmanUrl = chrome.runtime.getURL("html/postman/postman.html") + "?t=" + new Date().getTime();
        chrome.tabs.create({url: postmanUrl});
    });
});