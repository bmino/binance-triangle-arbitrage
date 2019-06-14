<?php

$logs = file_get_contents('../logs/performance.log');
$logs = explode("\n", $logs);

?>

<html>
	<head>
		<title>Bermuda | Performance Logs</title>
		<link rel="stylesheet" type="text/css" href="https://cdn.datatables.net/1.10.19/css/jquery.dataTables.min.css" type="text/css">
	</head>
	<body>
		<h1>Performance Logs</h1>
		<table id="log" style="width:100%">
		    <thead>
		        <tr>
		            <th>Timestamp</th>
		            <th>Level</th>
		            <th>Log</th>
		        </tr>
		    </thead>
		    <tbody>
	        	<?php foreach($logs as $log) { ?>
	        		<tr>
	        			<td><?php echo trim(str_replace('["', '', str_replace('"]', '', substr($log, 0, strpos($log, " [32m"))))); ?></td>
	        			<td><?php echo trim(substr($log, (strpos($log, " [32m") + 6), strpos($log, '[39m') - (strpos($log, " [32m") + 6))); ?></td>
	        			<td><?php echo trim(str_replace("[39m", "", substr($log, (strpos($log, "[36m") + 5)))); ?></td>
	        		</tr>
	        	<?php } ?>
		        </tr>
		    </tbody>
		</table>
		<footer>
			<p><a href="/">HUD</a> | <a href="/execution">Execution Log</a> | <a href="/performance">Performance Log</a></p>
		</footer>
		<script type="text/javascript" src="https://code.jquery.com/jquery-3.3.1.js"></script>
		<script type="text/javascript" src="https://cdn.datatables.net/1.10.19/js/jquery.dataTables.min.js"></script>
		<script type="text/javascript">
			$(document).ready(function() {
			    $('#log').DataTable({
        			"order": [[ 0, "desc" ]]
    			});
			});
		</script>
	</body>
</html>