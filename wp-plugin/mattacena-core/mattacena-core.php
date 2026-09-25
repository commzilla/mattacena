<?php
/**
 * Plugin Name:       Mattacena Core
 * Description:       API for the Mattacena staff app (app.mattacena.com): bookings, tables and staff logins. Works on top of the existing Restaurant Reservations tables, so bookings from the website form show up in the app and vice versa.
 * Version:           0.1.0
 * Requires PHP:      8.1
 * Author:            Mattacena
 * License:           GPLv2 or later
 * Text Domain:       mattacena-core
 */

defined('ABSPATH') || exit;

define('MC_VERSION', '0.1.0');
define('MC_NS', 'mattacena/v1');

/**
 * Origins allowed to call the API from a browser. Override in wp-config.php with
 * define('MC_ALLOWED_ORIGINS', 'https://app.mattacena.com,https://other.example');
 */
if (!defined('MC_ALLOWED_ORIGINS')) {
    define('MC_ALLOWED_ORIGINS', 'https://app.mattacena.com,http://localhost:5174');
}

require_once __DIR__ . '/includes/class-install.php';
require_once __DIR__ . '/includes/class-auth.php';
require_once __DIR__ . '/includes/class-repo.php';
require_once __DIR__ . '/includes/class-rest.php';

register_activation_hook(__FILE__, ['MC_Install', 'activate']);
add_action('plugins_loaded', ['MC_Install', 'maybe_upgrade']);
add_action('rest_api_init', ['MC_Rest', 'register']);
MC_Rest::cors();
MC_Install::keep_staff_out_of_admin();
