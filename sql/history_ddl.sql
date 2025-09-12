DROP TABLE IF EXISTS history;
CREATE TABLE history
(
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    url         VARCHAR(2048) NOT NULL COMMENT 'Request URL for fuzzy matching',
    curl_string TEXT          NOT NULL COMMENT 'Full cURL command string',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Request timestamp',
    INDEX       idx_url (url(255)) COMMENT 'Index for fuzzy URL matching',
    INDEX       idx_created_at (created_at) COMMENT 'Index for sorting by timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT 'Stores API request history as cURL commands';