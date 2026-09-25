<?php
defined('ABSPATH') || exit;

/** Database tables, staff roles and wp-admin lockout for staff accounts. */
class MC_Install
{
    const DB_VERSION = '1';

    /** WordPress role => app role. Administrators are always "titolare". */
    const ROLES = [
        'mc_titolare'     => ['titolare', 'Mattacena – Titolare'],
        'mc_responsabile' => ['responsabile', 'Mattacena – Responsabile di sala'],
        'mc_cameriere'    => ['cameriere', 'Mattacena – Cameriere'],
    ];

    public static function activate(): void
    {
        self::create_tables();
        foreach (self::ROLES as $slug => [, $label]) {
            if (!get_role($slug)) {
                add_role($slug, $label, ['read' => true, 'mc_access' => true]);
            }
        }
        update_option('mc_db_version', self::DB_VERSION);
    }

    public static function maybe_upgrade(): void
    {
        if (get_option('mc_db_version') !== self::DB_VERSION) {
            self::activate();
        }
    }

    private static function create_tables(): void
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $c = $wpdb->get_charset_collate();

        // Login sessions of the app. Only a SHA-256 hash of each token is stored.
        dbDelta("CREATE TABLE {$wpdb->prefix}mc_tokens (
            id bigint unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint unsigned NOT NULL,
            token_hash char(64) NOT NULL,
            created_at datetime NOT NULL,
            last_used_at datetime NOT NULL,
            user_agent varchar(190) NOT NULL DEFAULT '',
            PRIMARY KEY  (id),
            UNIQUE KEY token_hash (token_hash),
            KEY user_id (user_id)
        ) $c;");

        // Fields the legacy booking table has no column for.
        dbDelta("CREATE TABLE {$wpdb->prefix}mc_booking_meta (
            booking_id bigint unsigned NOT NULL,
            source varchar(20) NOT NULL DEFAULT '',
            discount varchar(60) NOT NULL DEFAULT '',
            updated_by bigint unsigned NOT NULL DEFAULT 0,
            updated_at datetime NOT NULL,
            PRIMARY KEY  (booking_id)
        ) $c;");

        // Who changed what, from the app.
        dbDelta("CREATE TABLE {$wpdb->prefix}mc_audit (
            id bigint unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint unsigned NOT NULL,
            booking_id bigint unsigned NOT NULL DEFAULT 0,
            action varchar(30) NOT NULL,
            detail varchar(255) NOT NULL DEFAULT '',
            created_at datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY booking_id (booking_id)
        ) $c;");
    }

    /** Staff accounts use the app only: no dashboard, no admin bar. */
    public static function keep_staff_out_of_admin(): void
    {
        add_action('admin_init', function () {
            if (wp_doing_ajax() || current_user_can('edit_posts')) {
                return;
            }
            $u = wp_get_current_user();
            if (array_intersect(array_keys(self::ROLES), (array) $u->roles)) {
                wp_safe_redirect('https://app.mattacena.com/');
                exit;
            }
        });
        add_filter('show_admin_bar', function ($show) {
            $u = wp_get_current_user();
            return array_intersect(array_keys(self::ROLES), (array) $u->roles) && !current_user_can('edit_posts') ? false : $show;
        });
    }
}
