<?php

// Whatever you want your password to be, put it here.
if (($_SERVER['REQUEST_METHOD'] == 'POST') && !empty($_POST['password']) && ($_POST['password'] == 'MySuperSecurePassword')) {
	// Whatever your local server is called, put it here.
	if ($_SERVER['HTTP_HOST'] == 'localhost') {
		$process = shell_exec('nohup node ../src/main/Main.js --prod > /dev/null 2>/dev/null &');
	} else {
		$process = shell_exec('nohup /usr/local/bin/node /var/www/html/bermuda/src/main/Main.js --prod &');
	}
}

header('Location: /');
exit;

?>