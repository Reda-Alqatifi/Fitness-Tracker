<?php

//! to redirect the user to the welcome page if he try to run the backend alone
header('Location: ../Frontend/Pages/welcome/welcome.html', true, 302);

exit;
