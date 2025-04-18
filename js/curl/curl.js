let requestData = {}; // 全局变量

$(document).ready(function () {
    $("#parseBtn").click(function () {
        const curlText = $("#curlInput").val().trim();
        if (!curlText) return;

        requestData = parseCurl(curlText);
        displayResult(requestData);
    });

    $("#sendBtn").click(function () {
        $(this).attr("disabled", true);

        const result = parseCurl($("#curlInput").val().trim());
        if (!result.url) {
            $("#response").text("Error: No URL found to send request.");
            $(this).attr("disabled", false);
            return;
        }
        sendRequest(result);
    });

    $("#addHeaderBtn").click(function () {
        if (!requestData.headers) requestData.headers = {};
        const newHeaderName = "New-Header-" + Date.now();
        requestData.headers[newHeaderName] = "";

        const $result = $("#result");
        const scrollHeight = $result[0].scrollHeight;
        const scrollTop = $result[0].scrollTop;
        const clientHeight = $result[0].clientHeight;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

        displayHeaders(requestData.headers);
        updateCurlInput();

        if (isAtBottom) {
            $result.scrollTop($result[0].scrollHeight);
        }
    });

    $("#headers").on("input", "textarea", function () {
        const $row = $(this).closest("tr");
        const name = $row.find("td:eq(0) textarea").val();
        const value = $row.find("td:eq(1) textarea").val();
        const oldName = $row.data("headerName");

        if (oldName !== name) {
            delete requestData.headers[oldName];
        }
        requestData.headers[name] = value;
        $row.data("headerName", name);
        updateCurlInput();

        this.style.height = "auto";
        this.style.height = this.scrollHeight + "px";
    });

    $("#data").on("input", function () {
        requestData.data = $(this).val();
        updateCurlInput();
    });

    $("#url").on("input", function () {
        requestData.url = $(this).val();
        updateCurlInput();
    });
});

function parseCurl(curlText) {
    const result = {
        url: "",
        method: "GET",
        headers: {},
        data: ""
    };

    const cleanText = curlText.replace(/\\\s*\n\s*/g, " ").trim();
    const parts = cleanText.match(/'[^']+'|"[^"]+"|[^\s'"]+/g) || [];
    if (!parts.length || parts[0] !== "curl") return result;

    for (let i = 1; i < parts.length; i++) {
        if (!parts[i].startsWith("-")) {
            result.url = parts[i].replace(/^['"]|['"]$/g, "");
            break;
        }
    }

    for (let i = 1; i < parts.length; i++) {
        if (parts[i] === "-X" || parts[i] === "--request") {
            result.method = parts[i + 1].replace(/^['"]|['"]$/g, "");
            i++;
        } else if (parts[i] === "-H" || parts[i] === "--header") {
            const header = parts[i + 1].replace(/^['"]|['"]$/g, "");
            const [name, value] = header.split(/:\s*(.+)/);
            if (name && value) result.headers[name] = value;
            i++;
        } else if (parts[i] === "-b" || parts[i] === "--cookie") {
            result.headers["Cookie"] = parts[i + 1].replace(/^['"]|['"]$/g, "");
            i++;
        } else if (parts[i] === "--data-raw" || parts[i] === "-d" || parts[i] === "--data") {
            result.data = parts[i + 1].replace(/^['"]|['"]$/g, "");
            result.method = "POST";
            i++;
        }
    }

    console.log("parseCurl result:", result);
    return result;
}

function displayResult(result) {
    $("#url").text(result.url || "Not found");
    $("#method").text(result.method || "GET");
    $("#data").val(result.data || ""); // 使用 val 设置 textarea
    displayHeaders(result.headers);
}

function displayHeaders(headers) {
    const $tbody = $("#headers tbody");
    $tbody.empty();
    if (headers && Object.keys(headers).length > 0) {
        for (const [name, value] of Object.entries(headers)) {
            const $row = $(`
                <tr data-header-name="${name}">
                  <td><textarea>${name}</textarea></td>
                  <td><textarea>${value}</textarea></td>
                </tr>
            `);
            $tbody.append($row);

            $row.find("textarea").each(function () {
                this.style.height = "auto";
                this.style.height = this.scrollHeight + "px";
            });
        }
    } else {
        $tbody.append("<tr><td colspan='2'>No headers found</td></tr>");
    }
}

function updateCurlInput() {
    let curl = `curl '${requestData.url}'`;

    if (requestData.method !== "GET") {
        curl += ` -X ${requestData.method}`;
    }

    for (const [name, value] of Object.entries(requestData.headers || {})) {
        if (name === "Cookie") {
            curl += ` -b '${value}'`;
        } else {
            curl += ` -H '${name}: ${value}'`;
        }
    }

    if (requestData.data) {
        curl += ` --data-raw '${requestData.data}'`;
    }

    $("#curlInput").val(curl);
}

function sendRequest(requestData) {
    console.log("requestData:", requestData);

    chrome.runtime.sendMessage({
        type: "setRequestHeaders",
        url: requestData.url,
        headers: requestData.headers || {}
    }, (response) => {
        if (response.success) {
            let startTime;
            $.ajax({
                url: requestData.url,
                method: requestData.method || "GET",
                data: requestData.method.toUpperCase() === "POST" ? requestData.data : undefined,
                beforeSend: function () {
                    $("#response").text("Sending...");

                    // 调用同步用户信息获取函数
                    const userInfoResult = fetchUserInfo(requestData);
                    console.log("userInfoResult:", userInfoResult);
                    if (userInfoResult.success) {
                        chrome.runtime.sendMessage({
                            type: "setRequestHeaders",
                            url: requestData.url,
                            headers: requestData.headers
                        });
                    } else if (userInfoResult.success === false && userInfoResult.userId === undefined) {
                        // 用户信息接口失败，显示错误并中止
                        $("#response").text("Error: Failed to fetch user info.");
                        $("#sendBtn").attr("disabled", false);
                        return false; // 中止主请求
                    }

                    displayResult(requestData);
                    startTime = performance.now();
                },
                success: function (response) {
                    const endTime = performance.now();
                    const duration = (endTime - startTime).toFixed(2);
                    let responseText;
                    try {
                        responseText = JSON.stringify(response, null, 2);
                    } catch (e) {
                        responseText = response;
                    }
                    $("#response").html(`<strong>Duration:</strong> ${duration} ms\n\n${responseText}`);
                    $("#sendBtn").attr("disabled", false);
                },
                error: function (xhr, status, error) {
                    const endTime = performance.now();
                    const duration = (endTime - startTime).toFixed(2);
                    $("#response").html(`<strong>Duration:</strong> ${duration} ms\n<strong>Error:</strong> ${status} - ${error}\n<strong>Details:</strong> ${xhr.responseText}`);
                    $("#sendBtn").attr("disabled", false);
                }
                // success: function (data, status, xhr) {
                //     // console.log(data);
                //     // console.log(status);
                //     // console.log(xhr);
                //
                //     const endTime = performance.now();
                //     const duration = (endTime - startTime).toFixed(2);
                //     let responseText = xhr.responseText;
                //     try {
                //         responseText = JSON.stringify(data, null, 2);
                //     } catch (e) {
                //         // responseText = response;
                //     }
                //
                //     // 加粗 Duration 和响应内容分开
                //     $("#response").html(`
                //         <strong>Duration:</strong> ${duration} ms\n
                //         <strong>Status:</strong> ${xhr.status}\n
                //         ${responseText}
                //     `);
                //     $("#sendBtn").attr("disabled", false);
                // },
                // error: function (xhr, status, error) {
                //     // console.log(xhr);
                //     // console.log(status);
                //     // console.log(error);
                //
                //     const endTime = performance.now();
                //     const duration = (endTime - startTime).toFixed(2);
                //
                //     // 加粗 Error 和 Details
                //     $("#response").html(`
                //         <strong>Duration:</strong> ${duration} ms\n
                //         <strong>Error:</strong> ${status} - ${error}\n
                //         <strong>Details:</strong> ${xhr.responseText}
                //     `);
                //     $("#sendBtn").attr("disabled", false);
                // }
            });
        } else {
            $("#response").text("Error: Failed to set request headers.");
            $("#sendBtn").attr("disabled", false);
        }
    });
}

function fetchUserInfo(requestData) {
    console.log("fetchUserInfo requestData:", requestData);

    const headers = requestData.headers || {};
    const hasAuth = headers["Authorization"] || headers["AuthToken"] || headers["authorization"] || headers["authToken"];

    console.log("fetchUserInfo hasAuth:", hasAuth);

    if (hasAuth) {
        let userId;
        let success = false;
        let paramHeaders = {"Authorization": hasAuth};

        if (headers["Client-Type"] || headers["client-type"]) {
            paramHeaders["Client-Type"] = headers["Client-Type"];
        }

        if (headers["PlatformCode"] || headers["platformcode"]) {
            paramHeaders["PlatformCode"] = headers["PlatformCode"];
        }

        console.log("fetchUserInfo paramHeaders:", paramHeaders);

        $.ajax({
            url: "http://gateway-ll.test.ztoeco.com/auth/getAuthInfo", // 替换为实际接口
            method: "GET",
            headers: paramHeaders,
            async: false, // 同步请求
            success: function (data, status, xhr) {
                userId = xhr.getResponseHeader("x-user-id");
                if (userId) {
                    requestData.headers["x-user-id"] = userId;
                    success = true;
                }
            },
            error: function (xhr, status, error) {
                console.error("Failed to get user info:", status, error);
            }
        });

        // 返回是否成功，以便决定是否更新 header
        return {
            success: success,
            userId: userId
        };
    }
    return {success: false}; // 未满足条件时不执行
}