function isEmpty(value) {
    // undefined 或 null
    if (value === undefined || value === null) {
        return true;
    }

    // 字符串
    if (typeof value === 'string') {
        return value.trim().length === 0;
    }

    // 数组
    if (Array.isArray(value)) {
        return value.length === 0;
    }

    // 对象
    if (typeof value === 'object') {
        return Object.keys(value).length === 0;
    }

    // 数字 (0 视为非空)
    if (typeof value === 'number') {
        return isNaN(value); // 只有 NaN 视为空
    }

    // 其他类型默认不为空
    return false;
}

function isNotEmpty(value) {
    return !isEmpty(value);
}