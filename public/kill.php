<?php

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
	// Whatever your local server is called, put it here.
	if ($_SERVER['HTTP_HOST'] == 'localhost') {
		$pid = shell_exec('ps aux | grep "Main.js --prod"');
	} else {
		$pid = shell_exec('ps -u | grep /usr/local/bin/node');
	}

	if (!empty($pid)) {
		$pid = explode(' ', $pid);
	}

	// Whatever your local server is called, put it here.
	if ($_SERVER['HTTP_HOST'] == 'localhost') {
		if (!empty($pid) && (!empty($pid[12]) && is_numeric($pid[12]))) {
			if ($pid[12] == $_POST['pid']) {
				shell_exec('kill -9 ' . $pid[12]);
			}
		}
	} else {
		if (!empty($pid) && (!empty($pid[2]) && is_numeric($pid[2]))) {
			shell_exec('kill -9 ' . $pid[2]);
		}
	}
}

header('Location: /');
exit;

?>