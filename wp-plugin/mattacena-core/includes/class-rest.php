<?php
defined('ABSPATH') || exit;

/** REST routes under /wp-json/mattacena/v1. Contract: docs/API.md. */
class MC_Rest
{
    const ALL = ['titolare', 'responsabile', 'cameriere'];
    const MANAGERS = ['titolare', 'responsabile'];
    /** Fields a waiter may change on an existing booking. */
    const WAITER_FIELDS = ['status', 'tables'];

    public static function register(): void
    {
        $ns = MC_NS;
        register_rest_route($ns, '/auth/login', [
            'methods' => 'POST', 'permission_callback' => '__return_true',
            'callback' => function (WP_REST_Request $r) {
                $res = MC_Auth::login((string) $r->get_param('email'), (string) $r->get_param('password'));
                return is_wp_error($res) ? $res : self::ok($res);
            },
        ]);
        register_rest_route($ns, '/auth/logout', [
            'methods' => 'POST', 'permission_callback' => '__return_true',
            'callback' => function (WP_REST_Request $r) {
                MC_Auth::logout($r);
                return new WP_REST_Response(null, 204);
            },
        ]);
        register_rest_route($ns, '/auth/me', [
            'methods' => 'GET', 'permission_callback' => MC_Auth::allow(self::ALL),
            'callback' => fn(WP_REST_Request $r) => self::ok(MC_Auth::user_payload(MC_Auth::user($r))),
        ]);
        register_rest_route($ns, '/bootstrap', [
            'methods' => 'GET', 'permission_callback' => MC_Auth::allow(self::ALL),
            'callback' => fn() => self::ok(['areas' => MC_Repo::areas(), 'tables' => MC_Repo::tables(), 'settings' => MC_Repo::settings()]),
        ]);
        register_rest_route($ns, '/bookings', [
            [
                'methods' => 'GET', 'permission_callback' => MC_Auth::allow(self::ALL),
                'callback' => [self::class, 'list_bookings'],
            ],
            [
                'methods' => 'POST', 'permission_callback' => MC_Auth::allow(self::ALL),
                'callback' => [self::class, 'create_booking'],
            ],
        ]);
        register_rest_route($ns, '/bookings/(?P<id>\d+)', [
            [
                'methods' => 'PATCH', 'permission_callback' => MC_Auth::allow(self::ALL),
                'callback' => [self::class, 'update_booking'],
            ],
            [
                'methods' => 'DELETE', 'permission_callback' => MC_Auth::allow(self::MANAGERS),
                'callback' => function (WP_REST_Request $r) {
                    $u = MC_Auth::user($r);
                    return MC_Repo::delete_booking((int) $r['id'], $u->ID)
                        ? new WP_REST_Response(null, 204)
                        : self::err('mc_not_found', 'Prenotazione non trovata.', 404);
                },
            ],
        ]);
        register_rest_route($ns, '/bookings/(?P<id>\d+)/status', [
            'methods' => 'POST', 'permission_callback' => MC_Auth::allow(self::ALL),
            'callback' => function (WP_REST_Request $r) {
                $status = (string) $r->get_param('status');
                if (!isset(MC_Repo::STATUS_TO_LEGACY[$status])) {
                    return self::err('mc_bad_status', 'Stato non valido.', 400);
                }
                $b = MC_Repo::update_booking((int) $r['id'], ['status' => $status], MC_Auth::user($r)->ID);
                return $b ? self::ok($b) : self::err('mc_not_found', 'Prenotazione non trovata.', 404);
            },
        ]);
    }

    public static function list_bookings(WP_REST_Request $r)
    {
        $from = (string) $r->get_param('from');
        $to = (string) $r->get_param('to');
        if (!self::is_date($from) || !self::is_date($to) || $to < $from) {
            return self::err('mc_bad_range', 'Intervallo di date non valido.', 400);
        }
        if ((strtotime($to) - strtotime($from)) / DAY_IN_SECONDS > 120) {
            return self::err('mc_range_too_long', 'Puoi caricare al massimo 120 giorni alla volta.', 400);
        }
        return self::ok(MC_Repo::list_bookings($from, $to));
    }

    public static function create_booking(WP_REST_Request $r)
    {
        $in = self::booking_input((array) $r->get_json_params(), true);
        if (is_wp_error($in)) {
            return $in;
        }
        return self::ok(MC_Repo::create_booking($in, MC_Auth::user($r)->ID), 201);
    }

    public static function update_booking(WP_REST_Request $r)
    {
        $user = MC_Auth::user($r);
        $raw = (array) $r->get_json_params();
        unset($raw['id']);
        if (MC_Auth::role_of($user) === 'cameriere') {
            // Waiters can seat guests and move them between tables, nothing else.
            $cur = MC_Repo::get_booking((int) $r['id']);
            foreach ($raw as $k => $v) {
                if (!in_array($k, self::WAITER_FIELDS, true) && $cur && array_key_exists($k, $cur) && $cur[$k] != $v) {
                    return self::err('mc_forbidden', 'Il tuo ruolo può cambiare solo stato e tavolo.', 403);
                }
            }
            $raw = array_intersect_key($raw, array_flip(self::WAITER_FIELDS));
        }
        $patch = self::booking_input($raw, false);
        if (is_wp_error($patch)) {
            return $patch;
        }
        $b = MC_Repo::update_booking((int) $r['id'], $patch, $user->ID);
        return $b ? self::ok($b) : self::err('mc_not_found', 'Prenotazione non trovata.', 404);
    }

    /** Validates a booking body. With $full every field is required, otherwise only the given ones are checked. */
    private static function booking_input(array $p, bool $full)
    {
        $out = [];
        $has = fn($k) => $full || array_key_exists($k, $p);

        if ($has('date')) {
            if (!self::is_date($p['date'] ?? '')) return self::err('mc_bad_date', 'Data non valida.', 400);
            $out['date'] = $p['date'];
        }
        if ($has('time')) {
            if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', (string) ($p['time'] ?? ''))) return self::err('mc_bad_time', 'Orario non valido.', 400);
            $out['time'] = $p['time'];
        }
        if ($has('guests')) {
            $g = filter_var($p['guests'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 60]]);
            if ($g === false) return self::err('mc_bad_guests', 'Numero di persone non valido (1–60).', 400);
            $out['guests'] = $g;
        }
        if ($has('name')) {
            $n = sanitize_text_field((string) ($p['name'] ?? ''));
            if ($n === '') return self::err('mc_bad_name', 'Scrivi il nome del cliente.', 400);
            $out['name'] = mb_substr($n, 0, 120);
        }
        if ($has('email')) {
            $e = sanitize_email((string) ($p['email'] ?? ''));
            if (($p['email'] ?? '') !== '' && !is_email($e)) return self::err('mc_bad_email', 'Email non valida.', 400);
            $out['email'] = $e;
        }
        if ($has('phone')) {
            $out['phone'] = mb_substr(preg_replace('/[^0-9+ ()\-.]/', '', (string) ($p['phone'] ?? '')), 0, 40);
        }
        if ($has('notes')) {
            $out['notes'] = mb_substr(sanitize_textarea_field((string) ($p['notes'] ?? '')), 0, 250);
        }
        if ($has('occasion')) {
            $o = (string) ($p['occasion'] ?? '');
            $out['occasion'] = in_array($o, MC_Repo::occasions(), true) ? $o : MC_Repo::occasions()[0];
        }
        if ($has('source')) {
            $s = (string) ($p['source'] ?? '');
            if (!in_array($s, MC_Repo::SOURCES, true)) return self::err('mc_bad_source', 'Origine non valida.', 400);
            $out['source'] = $s;
        }
        if ($has('status')) {
            $s = (string) ($p['status'] ?? '');
            if (!isset(MC_Repo::STATUS_TO_LEGACY[$s])) return self::err('mc_bad_status', 'Stato non valido.', 400);
            $out['status'] = $s;
        }
        if ($has('tables')) {
            $t = array_values(array_unique(array_map('strval', (array) ($p['tables'] ?? []))));
            if (array_diff($t, MC_Repo::table_ids())) return self::err('mc_bad_table', 'Tavolo inesistente.', 400);
            $out['tables'] = $t;
        }
        if (array_key_exists('discount', $p)) {
            $out['discount'] = mb_substr(sanitize_text_field((string) $p['discount']), 0, 60);
        }
        return $out;
    }

    private static function is_date($s): bool
    {
        return is_string($s) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $s) && checkdate((int) substr($s, 5, 2), (int) substr($s, 8, 2), (int) substr($s, 0, 4));
    }

    private static function ok($data, int $status = 200): WP_REST_Response
    {
        $res = new WP_REST_Response($data, $status);
        $res->header('Cache-Control', 'no-store');
        return $res;
    }

    private static function err(string $code, string $msg, int $status): WP_Error
    {
        return new WP_Error($code, $msg, ['status' => $status]);
    }

    /** CORS: only the app's origin may call these routes from a browser. */
    public static function cors(): void
    {
        add_filter('rest_allowed_cors_headers', fn($h) => array_merge($h, ['X-MC-Token']));
        add_filter('rest_pre_serve_request', function ($served, $result, WP_REST_Request $request) {
            if (!str_starts_with($request->get_route(), '/' . MC_NS)) {
                return $served;
            }
            $origin = get_http_origin();
            $allowed = array_map('trim', explode(',', MC_ALLOWED_ORIGINS));
            header_remove('Access-Control-Allow-Origin');
            header_remove('Access-Control-Allow-Credentials');
            if ($origin && in_array($origin, $allowed, true)) {
                header('Access-Control-Allow-Origin: ' . $origin);
                header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
                header('Access-Control-Allow-Headers: Content-Type, X-MC-Token');
                header('Access-Control-Max-Age: 600');
                header('Vary: Origin');
            }
            header('Cache-Control: no-store');
            return $served;
        }, 20, 3);
    }
}
