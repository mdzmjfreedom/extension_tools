chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "setRequestHeaders") {
        const {url, headers} = message;
        console.log("Received headers:", headers);

        // 手动确保 UTF-8 编码（理论上不需要，但作为调试）
        const formatHeaders = {};
        for (const [name, value] of Object.entries(headers)) {
            formatHeaders[name] = value.replace(/[\u4e00-\u9fa5]/g, char => encodeURIComponent(char)); // 直接使用原始值
        }
        console.log("Format headers:", formatHeaders);

        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [1],
            addRules: [
                {
                    id: 1,
                    priority: 1,
                    action: {
                        type: "modifyHeaders",
                        requestHeaders: Object.entries(formatHeaders).map(([name, value]) => ({
                            header: name,
                            operation: "set",
                            value: value
                        }))
                    },
                    condition: {
                        urlFilter: url,
                        resourceTypes: ["xmlhttprequest"]
                    }
                }
            ]
        }, () => {
            sendResponse({success: true});
        });
        return true; // 异步响应
    }
});