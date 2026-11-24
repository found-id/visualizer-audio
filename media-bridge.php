<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

$fp = @fsockopen('127.0.0.1', 19847, $errno, $errstr, 0.25);
if ($fp) {
    fclose($fp);
    echo json_encode(['running' => true]);
    exit;
}

$nodePath = 'D:\\Device\\Apps_mini\\node.js\\node.exe';
if (!file_exists($nodePath)) {
    $nodePath = 'node';
}
$serverScript = __DIR__ . '\\server.js';
$cmd = 'start /B "" "' . $nodePath . '" "' . $serverScript . '" > NUL 2>&1';
pclose(popen($cmd, 'r'));

usleep(600000);
echo json_encode(['running' => true, 'spawned' => true]);
