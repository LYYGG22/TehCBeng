<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // demo only; tighten for real deployments

// Use this when the endpoint's JSON shape is a fixed spec (e.g. { "recent_cases": [...] }).
// Outputs exactly what's passed in, no wrapper.
function jsonRaw($data) {
    echo json_encode($data);
    exit;
}

function jsonError($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}
