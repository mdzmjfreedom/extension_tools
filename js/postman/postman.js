$(document).ready(function () {
    var selectedIndex = -1; // 跟踪选中的历史项索引

    // Add initial header row
    // addHeaderRow();

    // Add header button
    $('#add-header-btn').click(function () {
        addHeaderRow();
        // Force scroll to bottom to show new header row
        $('#headers-container').scrollTop($('#headers-container')[0].scrollHeight);
    });

    // Send request
    $('#send-btn').click(function () {
        sendRequest();
    });

    // Show cURL modal with animation
    $('#curl-btn').click(function () {
        $('#curl-input').val('');
        $('#curl-error').hide().text('');
        $('#curl-modal').css('display', 'flex'); // 显示并触发动画
        setTimeout(() => {
            $('#curl-modal').addClass('show'); // 延迟添加 show 类以触发动画
        }, 10); // 短暂延迟确保过渡生效
        $('#curl-btn').prop('disabled', true);
        $('#curl-input').focus();
    });

    // Parse cURL
    $('#parse-curl-btn').click(function () {
        if (parseCurl()) {
            $('#curl-modal').removeClass('show'); // 触发淡出动画
            setTimeout(() => {
                $('#curl-modal').css('display', 'none'); // 动画结束后隐藏
                $('#curl-input').val(''); // 清空输入框
                $('#curl-error').hide().text(''); // 清除错误提示
            }, 300); // 与 CSS transition 时长一致
            $('#curl-btn').prop('disabled', false);
        }
    });

    // Cancel cURL modal
    $('#cancel-curl-btn').click(function () {
        $('#curl-modal').removeClass('show'); // 触发淡出动画
        setTimeout(() => {
            $('#curl-modal').css('display', 'none'); // 动画结束后隐藏
            $('#curl-input').val('');
            $('#curl-error').hide().text('');
            $('#curl-btn').prop('disabled', false);
        }, 300); // 与 CSS transition 时长一致
    });

    // Close modal on Esc key and handle history suggestions keyboard navigation
    $(document).keydown(function (e) {
        if (e.key === 'Escape' && $('#curl-modal').is(':visible')) {
            $('#curl-modal').removeClass('show'); // 触发淡出动画
            setTimeout(() => {
                $('#curl-modal').css('display', 'none'); // 动画结束后隐藏
                $('#curl-input').val('');
                $('#curl-error').hide().text('');
                $('#curl-btn').prop('disabled', false);
            }, 300); // 与 CSS transition 时长一致
        } else if ($('#history-suggestions').is(':visible')) {
            // 只选择有 data-curl 属性的 .history-item
            const items = $('.history-item[data-curl]');
            if (items.length === 0) return; // 如果没有有效历史记录，直接返回

            if (e.key === 'ArrowDown') {
                e.preventDefault(); // 防止页面滚动
                selectedIndex = (selectedIndex + 1) % items.length;
                items.removeClass('selected').eq(selectedIndex).addClass('selected');
                // 确保选中项可见
                items.eq(selectedIndex)[0].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault(); // 防止页面滚动
                selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                items.removeClass('selected').eq(selectedIndex).addClass('selected');
                // 确保选中项可见
                items.eq(selectedIndex)[0].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault(); // 防止表单提交
                const selectedItem = items.eq(selectedIndex);
                parseCurl(selectedItem.data('curl'));
                $('#history-suggestions').hide();
                selectedIndex = -1; // 重置索引
            }
        }
    });

    // Request tab switching
    $('.request-tab').click(function () {
        $('.request-tab').removeClass('active');
        $(this).addClass('active');
        $('#body-section, #headers-section').removeClass('active');
        $('#' + $(this).data('tab') + '-section').addClass('active');
    });

    // Response tab switching
    $('.tab').click(function () {
        $('.tab').removeClass('active');
        $(this).addClass('active');
        $('#response-body, #response-headers').removeClass('active');
        $('#response-' + $(this).data('tab')).addClass('active');
    });

    // Content-Type radio change
    $('input[name="content-type"]').change(function () {
        const contentType = $(this).val();

        // Remove existing Content-Type header row
        $('#headers-container .header-row').each(function () {
            const keyInput = $(this).find('.header-key');
            if (keyInput.val().toLowerCase() === 'content-type') {
                $(this).remove();
            }
        });

        // Add new Content-Type header row if not 'none'
        if (contentType !== 'none') {
            addHeaderRow('Content-Type', contentType);
            $('#headers-container').scrollTop($('#headers-container')[0].scrollHeight);
        }

        // Format JSON in body-textarea if content-type is application/json
        if (contentType === 'application/json') {
            const body = $('#body-textarea').val().trim();
            if (body) {
                try {
                    const parsed = JSON.parse(body);
                    $('#body-textarea').val(JSON.stringify(parsed, null, 2));
                } catch (e) {
                    // Do nothing, keep raw input if invalid JSON
                }
            }
        }
    });

    // URL input for history suggestions
    $('#url-input').on('input', function () {
        const query = $(this).val().trim();
        const urlInput = $(this);
        const methodSelectWidth = $('#method-select').outerWidth(true); // 包括 margin
        $('#history-suggestions').css({
            'width': urlInput.outerWidth() + 'px',
            'left': methodSelectWidth + 'px' // 动态计算 #method-select 的宽度
        });
        if (query.length >= 3) {
            $.ajax({
                url: `http://127.0.0.1:4430/curlHistory/query?url=${encodeURIComponent(query)}`,
                method: 'GET',
                success: function (data) {
                    $('#history-suggestions').empty().show();
                    selectedIndex = -1; // 重置选中索引
                    if (!data.success || !data.result || data.result.length === 0) {
                        $('#history-suggestions').append('<div class="history-item">No matching history</div>');
                    } else {
                        data.result.forEach(item => {
                            const itemDiv = $(`
                                <div class="history-item" data-curl="${item.curlString.replace(/"/g, '&quot;')}">
                                    <div class="history-url">${item.url}</div>
                                    <div class="history-time">${new Date(item.createdAt).toLocaleString()}</div>
                                </div>
                            `);
                            $('#history-suggestions').append(itemDiv);
                            itemDiv.click(function () {
                                parseCurl($(this).data('curl'));
                                $('#history-suggestions').hide();
                                selectedIndex = -1; // 重置索引
                            });
                        });
                    }
                },
                error: function (xhr, status, error) {
                    console.error('Failed to fetch history:', error);
                    $('#history-suggestions').empty().show().append('<div class="history-item">Error fetching history</div>');
                    selectedIndex = -1; // 重置选中索引
                }
            });
        } else {
            $('#history-suggestions').hide();
            selectedIndex = -1; // 重置选中索引
        }
    });

    // Hide suggestions when clicking outside
    $(document).click(function (e) {
        if (!$(e.target).closest('#url-input, #history-suggestions').length) {
            $('#history-suggestions').hide();
            selectedIndex = -1; // 重置选中索引
        }
    });

    // Auto-format JSON in body-textarea on blur
    $('#body-textarea').on('blur', function () {
        const contentType = $('input[name="content-type"]:checked').val();
        if (contentType === 'application/json') {
            const body = $(this).val().trim();
            if (body) {
                try {
                    const parsed = JSON.parse(body);
                    $(this).val(JSON.stringify(parsed, null, 2));
                } catch (e) {
                    // Do nothing, keep raw input if invalid JSON
                }
            }
        }
    });

    $('#body-textarea').on('input', function () {
        const contentType = $('input[name="content-type"]:checked').val();
        if (contentType === 'application/json') {
            const body = $(this).val().trim();
            if (body) {
                try {
                    const parsed = JSON.parse(body);
                    $(this).val(JSON.stringify(parsed, null, 2));
                } catch (e) {
                    // Do nothing, keep raw input
                }
            }
        }
    });
});

function addHeaderRow(key = '', value = '') {
    const row = $('<div class="header-row"></div>');
    row.append(`<input type="text" class="header-key" placeholder="Key" value="${key}">`);
    row.append(`<input type="text" class="header-value" placeholder="Value" value="${value}">`);
    row.append('<button type="button" class="remove-header-btn" style="margin-left:5px; background-color:#dc3545; color:white; border:none; padding:5px 10px; cursor:pointer;">Remove</button>');
    $('#headers-container').append(row);

    row.find('.remove-header-btn').click(function () {
        row.remove();
    });
}

function sendRequest() {
    $('#response-body').text('');
    $('#response-headers').text('');
    $('#response-status').text('').removeClass('success error');
    $('#response-time').text('');
    const method = $('#method-select').val();
    const url = $('#url-input').val().trim();
    const contentType = $('input[name="content-type"]:checked').val();
    const body = $('#body-textarea').val().trim();

    if (!url) {
        $('#response-body').text('Error: URL cannot be empty');
        return;
    }

    if (contentType === 'application/json' && body) {
        try {
            const parsed = JSON.parse(body);
            $('#body-textarea').val(JSON.stringify(parsed, null, 2)); // Format JSON in textarea
        } catch (e) {
            $('#response-body').text('Error: Invalid JSON format in body');
            return;
        }
    }

    const headers = {};
    const attemptedHeaders = [];
    $('#headers-container .header-row').each(function () {
        const key = $(this).find('.header-key').val().trim();
        const value = $(this).find('.header-value').val().trim();
        if (key) {
            headers[key] = value;
            attemptedHeaders.push(key);
        }
    });
    // Only set Content-Type if not 'none'
    if (contentType !== 'none') {
        headers['Content-Type'] = contentType;
    }

    let requestData = { url, method, headers };
    if (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH') {
        if (contentType === 'application/x-www-form-urlencoded' && body) {
            const params = {};
            body.split('\n').forEach(line => {
                const [key, value] = line.split('=', 2);
                if (key && value !== undefined) {
                    params[key.trim()] = value.trim();
                }
            });
            requestData.data = params;
        } else if (contentType === 'application/json' && body) {
            requestData.data = JSON.parse(body); // Send parsed JSON object
        } else {
            requestData.data = body;
        }
    }

    $('#loading-overlay').css('display', 'flex');
    $('#send-btn').text('Loading...').prop('disabled', true);

    const startTime = performance.now();

    chrome.runtime.sendMessage({
        type: "setRequestHeaders",
        url: url,
        headers: headers
    }, (response) => {
        if (response.success) {
            $.ajax({
                url: url,
                method: method,
                data: requestData.data,
                contentType: contentType !== 'none' ? contentType : false,
                success: function (response, status, xhr) {
                    const responseTime = Math.round(performance.now() - startTime);
                    let responseText = JSON.stringify(response, null, 2);
                    if (attemptedHeaders.length > 0) {
                        responseText = `Note: Some headers may not be applied due to browser or server restrictions.\nAttempted headers: ${attemptedHeaders.join(', ')}\n\n${responseText}`;
                    }
                    $('#response-body').text(responseText);
                    $('#response-status').text(`${xhr.status} ${xhr.statusText}`).addClass('success');
                    $('#response-time').text(`${responseTime} ms`);
                    const respHeaders = [];
                    xhr.getAllResponseHeaders().trim().split('\n').forEach(function (header) {
                        respHeaders.push(header);
                    });
                    $('#response-headers').text(respHeaders.join('\n'));

                    // 在sendRequest的success中
                    if (xhr.status === 200) {
                        console.log(requestData.data);
                        const curlString = generateCurl(url, headers, requestData.data, contentType);
                        console.log(curlString);

                        $.ajax({
                            url: 'http://127.0.0.1:4430/curlHistory/save',
                            method: 'POST',
                            contentType: 'application/json',
                            data: JSON.stringify({ url, curlString }),
                            success: function (data) {
                                if (!data.success) {
                                    console.error('Failed to save history:', data.message);
                                }
                            },
                            error: function (xhr, status, error) {
                                console.error('Failed to save history:', error);
                            }
                        });
                    }
                },
                error: function (xhr, status, error) {
                    const responseTime = Math.round(performance.now() - startTime);
                    let errorMsg = `Error: ${error}\n${xhr.responseText}`;
                    if (xhr.status === 0) {
                        errorMsg += '\nPossible CORS issue: Check if the server allows cross-origin requests.';
                    }
                    if (attemptedHeaders.length > 0) {
                        errorMsg = `Note: Some headers may not be applied due to browser or server restrictions.\nAttempted headers: ${attemptedHeaders.join(', ')}\n\n${errorMsg}`;
                    }
                    errorMsg += '\n\nTo set all headers, ensure server-side proxy or correct permissions are used.';
                    $('#response-body').text(errorMsg);
                    $('#response-status').text(xhr.status ? `${xhr.status} ${xhr.statusText}` : 'Failed').addClass('error');
                    $('#response-time').text(`${responseTime} ms`);
                    $('#response-headers').text(xhr.getAllResponseHeaders());
                },
                complete: function () {
                    $('#loading-overlay').css('display', 'none');
                    $('#send-btn').text('Send').prop('disabled', false);
                }
            });
        } else {
            $('#response-body').text(`Error: Failed to set request headers: ${response.error || 'Unknown error'}`);
            $('#response-status').text('Failed').addClass('error');
            $('#response-time').text('');
            $('#loading-overlay').css('display', 'none');
            $('#send-btn').text('Send').prop('disabled', false);
        }
    });
}

function parseCurl(curlText) {
    // 使用传入的 curlText，如果未传入则获取 #curl-input 的值
    const text = curlText || $('#curl-input').val().trim();
    if (!text) {
        $('#curl-error').text('Error: cURL command cannot be empty').show();
        return false;
    }
    if (!text.startsWith('curl')) {
        $('#curl-error').text('Error: Invalid cURL command').show();
        return false;
    }

    const result = {
        url: "",
        method: "GET",
        headers: {},
        data: "",
        urlEncodedParams: []
    };

    const cleanText = text.replace(/\\\s*\n\s*/g, " ").trim();
    const parts = cleanText.match(/'[^']+'|"[^"]+"|[^\s'"]+/g) || [];
    if (!parts.length || parts[0] !== "curl") {
        $('#curl-error').text('Error: Invalid cURL command structure').show();
        return false;
    }

    // Parse URL
    for (let i = 1; i < parts.length; i++) {
        if (!parts[i].startsWith("-")) {
            result.url = parts[i].replace(/^['"]|['"]$/g, "");
            break;
        }
    }

    // Parse method, headers, and data
    for (let i = 1; i < parts.length; i++) {
        if (parts[i] === "-X" || parts[i] === "--request") {
            result.method = parts[i + 1].replace(/^['"]|['"]$/g, "").toUpperCase();
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
        } else if (parts[i] === "--data-urlencode") {
            const param = parts[i + 1].replace(/^['"]|['"]$/g, "");
            result.urlEncodedParams.push(param);
            result.method = "POST";
            i++;
        }
    }

    if (!result.url) {
        $('#curl-error').text('Error: Invalid or missing URL in cURL command').show();
        return false;
    }

    // Fill form
    $('#method-select').val(result.method);
    $('#url-input').val(result.url);
    $('#headers-container').empty();
    for (const [key, value] of Object.entries(result.headers)) {
        addHeaderRow(key, value);
    }

    const contentTypeHeader = Object.keys(result.headers).find(key => key.toLowerCase() === 'content-type');
    let normalizedContentType = 'none';
    if (contentTypeHeader) {
        const headerValue = result.headers[contentTypeHeader].toLowerCase();
        if (headerValue.startsWith('application/json')) {
            normalizedContentType = 'application/json';
        } else if (headerValue.startsWith('application/x-www-form-urlencoded')) {
            normalizedContentType = 'application/x-www-form-urlencoded';
        }
    }

    if ($('input[name="content-type"][value="' + normalizedContentType + '"]').length > 0) {
        $('input[name="content-type"][value="' + normalizedContentType + '"]').prop('checked', true);
    } else {
        $('input[name="content-type"][value="none"]').prop('checked', true);
        $('#headers-container .header-row').each(function () {
            const keyInput = $(this).find('.header-key');
            if (keyInput.val().toLowerCase() === 'content-type') {
                $(this).remove();
            }
        });
    }

    const contentType = contentTypeHeader ? result.headers[contentTypeHeader] : 'none';
    if (normalizedContentType === 'application/json' && result.data) {
        try {
            const parsed = JSON.parse(result.data);
            $('#body-textarea').val(JSON.stringify(parsed, null, 2)); // Format JSON
        } catch (e) {
            $('#curl-error').text('Error: Invalid JSON format in cURL data').show();
            return false;
        }
    } else if (normalizedContentType === 'application/x-www-form-urlencoded' && result.urlEncodedParams.length > 0) {
        $('#body-textarea').val(result.urlEncodedParams.join('\n'));
    } else {
        $('#body-textarea').val(result.data);
    }

    return true;
}

function generateCurl(url, headers, body, contentType) {
    let curl = `curl --location '${url.replace(/'/g, "\\'")}'`;
    for (const [key, value] of Object.entries(headers)) {
        curl += ` -H '${key}: ${value.replace(/'/g, "\\'")}'`;
    }
    if (body && contentType.startsWith('application/x-www-form-urlencoded') && typeof body === 'object') {
        for (const [key, value] of Object.entries(body)) {
            if (key && value !== undefined) {
                curl += ` --data-urlencode '${key}=${value.replace(/'/g, "\\'")}'`;
            }
        }
    } else if (body && typeof body === 'string') {
        curl += ` --data-raw '${body.replace(/'/g, "\\'")}'`;
    }
    return curl;
}