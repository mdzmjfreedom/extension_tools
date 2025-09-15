$(document).ready(function() {
    // Add initial header row
    addHeaderRow();

    // Add header button
    $('#add-header-btn').click(function() {
        addHeaderRow();
        // Force scroll to bottom to show new header row
        $('#headers-container').scrollTop($('#headers-container')[0].scrollHeight);
    });

    // Send request
    $('#send-btn').click(function() {
        sendRequest();
    });

    // Show cURL modal and focus input
    $('#curl-btn').click(function() {
        $('#curl-input').val('');
        $('#curl-error').hide().text('');
        $('#curl-modal').css('display', 'flex');
        $('#curl-btn').prop('disabled', true);
        $('#curl-input').focus();
    });

    // Parse cURL
    $('#parse-curl-btn').click(function() {
        if (parseCurl()) {
            $('#curl-modal').css('display', 'none');
            $('#curl-btn').prop('disabled', false);
        }
    });

    // Cancel cURL modal
    $('#cancel-curl-btn').click(function() {
        $('#curl-modal').css('display', 'none');
        $('#curl-input').val('');
        $('#curl-error').hide().text('');
        $('#curl-btn').prop('disabled', false);
    });

    // Close modal on Esc key
    $(document).keydown(function(e) {
        if (e.key === 'Escape' && $('#curl-modal').is(':visible')) {
            $('#curl-modal').css('display', 'none');
            $('#curl-input').val('');
            $('#curl-error').hide().text('');
            $('#curl-btn').prop('disabled', false);
        }
    });

    // Request tab switching
    $('.request-tab').click(function() {
        $('.request-tab').removeClass('active');
        $(this).addClass('active');
        $('#body-section, #headers-section').removeClass('active');
        $('#' + $(this).data('tab') + '-section').addClass('active');
    });

    // Response tab switching
    $('.tab').click(function() {
        $('.tab').removeClass('active');
        $(this).addClass('active');
        $('#response-body, #response-headers').removeClass('active');
        $('#response-' + $(this).data('tab')).addClass('active');
    });

    // Content-Type radio change
    $('input[name="content-type"]').change(function() {
        const contentType = $(this).val();
        // Remove existing Content-Type header row
        $('#headers-container .header-row').each(function() {
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
    });

    // URL input for history suggestions
    $('#url-input').on('input', function() {
        const query = $(this).val().trim();
        if (query.length >= 3) {
            fetch(`/api/history?query=${encodeURIComponent(query)}`)
                .then(res => res.json())
                .then(data => {
                    $('#history-suggestions').empty().show();
                    if (data.length === 0) {
                        $('#history-suggestions').append('<div class="history-item">No matching history</div>');
                    } else {
                        data.forEach(item => {
                            const itemDiv = $(`
                                <div class="history-item" data-curl="${item.curl_string.replace(/"/g, '&quot;')}">
                                    <div class="history-url">${item.url}</div>
                                    <div class="history-time">${new Date(item.created_at).toLocaleString()}</div>
                                </div>
                            `);
                            $('#history-suggestions').append(itemDiv);
                            itemDiv.click(function() {
                                parseCurl($(this).data('curl'));
                                $('#history-suggestions').hide();
                            });
                        });
                    }
                })
                .catch(err => {
                    console.error('Failed to fetch history:', err);
                    $('#history-suggestions').empty().show().append('<div class="history-item">Error fetching history</div>');
                });
        } else {
            $('#history-suggestions').hide();
        }
    });

    // Hide suggestions when clicking outside
    $(document).click(function(e) {
        if (!$(e.target).closest('#url-input, #history-suggestions').length) {
            $('#history-suggestions').hide();
        }
    });
});

function addHeaderRow(key = '', value = '') {
    const row = $('<div class="header-row"></div>');
    row.append(`<input type="text" class="header-key" placeholder="Key" value="${key}">`);
    row.append(`<input type="text" class="header-value" placeholder="Value" value="${value}">`);
    row.append('<button type="button" class="remove-header-btn" style="margin-left:5px; background-color:#dc3545; color:white; border:none; padding:5px 10px; cursor:pointer;">Remove</button>');
    $('#headers-container').append(row);

    row.find('.remove-header-btn').click(function() {
        row.remove();
    });
}

function generateCurl(method, url, headers, body, contentType) {
    let curl = `curl -X ${method} '${url.replace(/'/g, "\\'")}'`;
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

function sendRequest() {
    $('#response-body').text('');
    $('#response-headers').text('');
    $('#response-status').text('').removeClass('success error');
    $('#response-time').text('');
    const method = $('#method-select').val();
    const url = $('#url-input').val().trim();
    const contentType = $('input[name="content-type"]:checked').val();
    const body = $('#body-textarea').val();

    if (!url) {
        $('#response-body').text('Error: URL cannot be empty');
        return;
    }

    if (contentType === 'application/json' && body) {
        try {
            JSON.parse(body);
        } catch (e) {
            $('#response-body').text('Error: Invalid JSON format in body');
            return;
        }
    }

    const headers = {};
    const attemptedHeaders = [];
    $('#headers-container .header-row').each(function() {
        const key = $(this).find('.header-key').val().trim();
        const value = $(this).find('.header-value').val().trim();
        if (key) {
            headers[key] = value;
            attemptedHeaders.push(key);
        }
    });
    if (contentType !== 'none') {
        headers['Content-Type'] = contentType;
    }

    let requestData = { url, method, headers };
    let curlBody = body; // Default for application/json or none
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
            curlBody = params; // Use params object for generateCurl
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
                success: function(response, status, xhr) {
                    const responseTime = Math.round(performance.now() - startTime);
                    let responseText = JSON.stringify(response, null, 2);
                    if (attemptedHeaders.length > 0) {
                        responseText = `Note: Some headers may not be applied due to browser or server restrictions.\nAttempted headers: ${attemptedHeaders.join(', ')}\n\n${responseText}`;
                    }
                    $('#response-body').text(responseText);
                    $('#response-status').text(`${xhr.status} ${xhr.statusText}`).addClass('success');
                    $('#response-time').text(`${responseTime} ms`);
                    const respHeaders = [];
                    xhr.getAllResponseHeaders().trim().split('\n').forEach(function(header) {
                        respHeaders.push(header);
                    });
                    $('#response-headers').text(respHeaders.join('\n'));

                    // Save history for status 200
                    if (xhr.status === 200) {
                        const curlString = generateCurl(method, url, headers, curlBody, contentType);
                        fetch('/api/history', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url, curl: curlString })
                        }).catch(err => console.error('Failed to save history:', err));
                    }
                },
                error: function(xhr, status, error) {
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
                complete: function() {
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
    if (!curlText) {
        $('#curl-error').text('Error: cURL command cannot be empty').show();
        return false;
    }
    if (!curlText.startsWith('curl')) {
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

    const cleanText = curlText.replace(/\\\s*\n\s*/g, " ").trim();
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
        $('#headers-container .header-row').each(function() {
            const keyInput = $(this).find('.header-key');
            if (keyInput.val().toLowerCase() === 'content-type') {
                $(this).remove();
            }
        });
    }

    const contentType = contentTypeHeader ? result.headers[contentTypeHeader] : 'none';
    if (normalizedContentType === 'application/x-www-form-urlencoded' && result.urlEncodedParams.length > 0) {
        $('#body-textarea').val(result.urlEncodedParams.join('\n'));
    } else {
        $('#body-textarea').val(result.data);
    }

    return true;
}