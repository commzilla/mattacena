<?php
defined('ABSPATH') || exit;

/** Token login for the app. Tokens are sent in the X-MC-Token header. */
class MC_Auth
{
    const TTL_DAYS = 30;           // session ends after 30 days without use
    const MAX_FAILS = 5;           // failed logins per email+IP ...
    const FAIL_WINDOW = 15 * 60;   // ... within 15 minutes

    /** App role of a WordPress user, or null if the user may not use the app. */
    public static function role_of(WP_User $u): ?string
    {
        if (user_can($u, 'manage_options')) {
            return 'titolare';
        }
        foreach (MC_Install::ROLES as $slug => [$role]) {
            if (in_array($slug, (array) $u->roles, true)) {
                return $role;
            }
        }
        return null;
    }

    public static function user_payload(WP_User $u): array
    {
        return [
            'id'    => (string) $u->ID,
            'name'  => $u->display_name ?: $u->user_login,
            'email' => $u->user_email,
            'role'  => self::role_of($u),
        ];
    }

    public static function login(string $email, string $password)
    {
        $key = 'mc_fail_' . md5(strtolower(trim($email)) . '|' . self::ip());
        $fails = (int) get_transient($key);
        if ($fails >= self::MAX_FAILS) {
            return new WP_Error('mc_locked', 'Troppi tentativi. Riprova tra 15 minuti.', ['status' => 429]);
        }

        $user = wp_authenticate(trim($email), $password);
        if (is_wp_error($user)) {
            set_transient($key, $fails + 1, self::FAIL_WINDOW);
            return new WP_Error('mc_bad_login', 'Email o password non corrette.', ['status' => 401]);
        }
        if (!self::role_of($user)) {
            return new WP_Error('mc_no_access', 'Questo account non ha accesso all’app. Chiedi al titolare di abilitarlo.', ['status' => 403]);
        }
        delete_transient($key);

        global $wpdb;
        $token = bin2hex(random_bytes(32));
        $now = current_time('mysql', true);
        $wpdb->insert($wpdb->prefix . 'mc_tokens', [
            'user_id'      => $user->ID,
            'token_hash'   => hash('sha256', $token),
            'created_at'   => $now,
            'last_used_at' => $now,
            'user_agent'   => substr(sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 190),
        ]);
        return ['token' => $token, 'user' => self::user_payload($user)];
    }

    public static function logout(WP_REST_Request $r): void
    {
        global $wpdb;
        $t = self::token($r);
        if ($t) {
            $wpdb->delete($wpdb->prefix . 'mc_tokens', ['token_hash' => hash('sha256', $t)]);
        }
    }

    /** The signed-in user for this request, or a WP_Error (401/403). */
    public static function user(WP_REST_Request $r)
    {
        static $cache = [];
        $t = self::token($r);
        if (!$t) {
            return new WP_Error('mc_no_session', 'Accedi per continuare.', ['status' => 401]);
        }
        $hash = hash('sha256', $t);
        if (isset($cache[$hash])) {
            return $cache[$hash];
        }
        global $wpdb;
        $table = $wpdb->prefix . 'mc_tokens';
        $row = $wpdb->get_row($wpdb->prepare("SELECT id, user_id, last_used_at FROM $table WHERE token_hash = %s", $hash));
        $expired = $row && strtotime($row->last_used_at . ' UTC') < time() - self::TTL_DAYS * DAY_IN_SECONDS;
        if (!$row || $expired) {
            if ($expired) {
                $wpdb->delete($table, ['id' => $row->id]);
            }
            return new WP_Error('mc_session_expired', 'Sessione scaduta: accedi di nuovo.', ['status' => 401]);
        }
        $user = get_user_by('id', (int) $row->user_id);
        if (!$user || !self::role_of($user)) {
            $wpdb->delete($table, ['id' => $row->id]);
            return new WP_Error('mc_no_access', 'Il tuo accesso all’app è stato disattivato.', ['status' => 403]);
        }
        // Slide the expiry, at most once an hour to avoid a write per request.
        if (strtotime($row->last_used_at . ' UTC') < time() - HOUR_IN_SECONDS) {
            $wpdb->update($table, ['last_used_at' => current_time('mysql', true)], ['id' => $row->id]);
        }
        return $cache[$hash] = $user;
    }

    /** permission_callback factory: allowed app roles for a route. */
    public static function allow(array $roles): callable
    {
        return function (WP_REST_Request $r) use ($roles) {
            $u = self::user($r);
            if (is_wp_error($u)) {
                return $u;
            }
            return in_array(self::role_of($u), $roles, true)
                ? true
                : new WP_Error('mc_forbidden', 'Il tuo ruolo non può fare questa operazione.', ['status' => 403]);
        };
    }

    private static function token(WP_REST_Request $r): ?string
    {
        $t = $r->get_header('x_mc_token');
        if (!$t) {
            $auth = $r->get_header('authorization');
            if ($auth && stripos($auth, 'Bearer ') === 0) {
                $t = substr($auth, 7);
            }
        }
        return $t && preg_match('/^[a-f0-9]{64}$/', $t) ? $t : null;
    }

    private static function ip(): string
    {
        return sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
    }
}
