$(document).ready(function() {
    // Add initial header row
    addHeaderRow();

    // Add header button
    $('#add-header-btn').click(function() {
        addHeaderRow();
    });

    // Send request
    $('#send-btn').click(function() {
        sendRequest();
    });

    // Show cURL modal
    $('#curl-btn').click(function() {
        $('#curl-input').val('');
        $('#curl-error').hide().text('');
        $('#curl-modal').css('display', 'flex');
        $('#curl-btn').prop('disabled', true);
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

    // Tab switching
    $('.tab').click(function() {
        $('.tab').removeClass('active');
        $(this).addClass('active');
        $('#response-body, #response-headers').removeClass('active');
        $('#response-' + $(this).data('tab')).addClass('active');
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

function sendRequest() {
    $('#response-body').text('');
    $('#response-headers').text('');
    $('#response-status').text('').removeClass('success error');
    $('#response-time').text('');
    const method = $('#method-select').val();
    const url = $('#url-input').val().trim();
    const contentType = $('#content-type-select').val();
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
    headers['Content-Type'] = contentType;

    const requestData = {
        url: url,
        method: method,
        headers: headers,
        data: body
    };

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
                data: method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH' ? body : undefined,
                contentType: contentType,
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

                    console.log(xhr.getAllResponseHeaders())

                    xhr.getAllResponseHeaders().trim().split('\n').forEach(function(header) {
                        respHeaders.push(header);
                    });
                    $('#response-headers').text(respHeaders.join('\n'));
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

function parseCurl() {
    const curlText = $('#curl-input').val().trim();
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
        data: ""
    };

    const cleanText = curlText.replace(/\\\s*\n\s*/g, " ").trim();
    const parts = cleanText.match(/'[^']+'|"[^"]+"|[^\s'"]+/g) || [];
    if (!parts.length || parts[0] !== "curl") {
        $('#curl-error').text('Error: Invalid cURL command structure').show();
        return false;
    }

    for (let i = 1; i < parts.length; i++) {
        if (!parts[i].startsWith("-")) {
            result.url = parts[i].replace(/^['"]|['"]$/g, "");
            break;
        }
    }

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
    if (contentTypeHeader && $('#content-type-select option[value="' + result.headers[contentTypeHeader] + '"]').length > 0) {
        $('#content-type-select').val(result.headers[contentTypeHeader]);
    } else if (contentTypeHeader) {
        $('#content-type-select').val('application/json');
        // Content-Type already added in headers
    } else {
        $('#content-type-select').val('application/json');
    }

    $('#body-textarea').val(result.data);
    return true;
}