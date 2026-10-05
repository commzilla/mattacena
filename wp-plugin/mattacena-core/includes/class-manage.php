<?php
defined('ABSPATH') || exit;

/**
 * Floor plan (areas, tables, positions) and restaurant settings.
 * Areas, tables and most settings live in the legacy plugin's tables and options,
 * so changes made in the app also apply to the public booking form.
 */
class MC_Manage
{
    const OWNER = ['titolare'];
    const MANAGERS = ['titolare', 'responsabile'];

    public static function register(): void
    {
        $ns = MC_NS;
        register_rest_route($ns, '/layout', [
            'methods' => 'PUT', 'permission_callback' => MC_Auth::allow(self::MANAGERS),
            'callback' => [self::class, 'save_layout'],
        ]);
        register_rest_route($ns, '/tables', [
            'methods' => 'POST', 'permission_callback' => MC_Auth::allow(self::MANAGERS),
            'callback' => [self::class, 'create_table'],
        ]);
        register_rest_route($ns, '/tables/(?P<id>\d+)', [
            ['methods' => 'PATCH', 'permission_callback' => MC_Auth::allow(self::MANAGERS), 'callback' => [self::class, 'update_table']],
            ['methods' => 'DELETE', 'permission_callback' => MC_Auth::allow(self::MANAGERS), 'callback' => [self::class, 'delete_table']],
        ]);
        register_rest_route($ns, '/areas', [
            'methods' => 'POST', 'permission_callback' => MC_Auth::allow(self::MANAGERS),
            'callback' => [self::class, 'create_area'],
        ]);
        register_rest_route($ns, '/areas/(?P<id>\d+)', [
            ['methods' => 'PATCH', 'permission_callback' => MC_Auth::allow(self::MANAGERS), 'callback' => [self::class, 'update_area']],
            ['methods' => 'DELETE', 'permission_callback' => MC_Auth::allow(self::MANAGERS), 'callback' => [self::class, 'delete_area']],
        ]);
        register_rest_route($ns, '/settings', [
            'methods' => 'PUT', 'permission_callback' => MC_Auth::allow(self::OWNER),
            'callback' => [self::class, 'save_settings'],
        ]);
    }

    private static function t(string $n): string
    {
        global $wpdb;
        return $wpdb->prefix . $n;
    }

    private static function ok($data, int $status = 200): WP_REST_Response
    {
        $r = new WP_REST_Response($data, $status);
        $r->header('Cache-Control', 'no-store');
        return $r;
    }

    private static function err(string $code, string $msg, int $status = 400): WP_Error
    {
        return new WP_Error($code, $msg, ['status' => $status]);
    }

    /* ---------- floor plan ---------- */

    private static function clean_pos(array $p, array $base = []): array
    {
        $shape = in_array($p['shape'] ?? '', ['round', 'square', 'rect'], true) ? $p['shape'] : ($base['shape'] ?? 'square');
        $rot = (int) ($p['rot'] ?? ($base['rot'] ?? 0));
        return [
            'x'     => max(0, min(1200, (int) ($p['x'] ?? ($base['x'] ?? 150)))),
            'y'     => max(0, min(760, (int) ($p['y'] ?? ($base['y'] ?? 150)))),
            'shape' => $shape,
            'rot'   => in_array($rot, [0, 45, 90, 135], true) ? $rot : 0,
        ];
    }

    /** Body: { tables: [{ id, x, y, shape, rot }] } — positions only. */
    public static function save_layout(WP_REST_Request $r)
    {
        $layout = (array) get_option('mc_layout', []);
        $valid = array_flip(MC_Repo::table_ids());
        foreach ((array) $r->get_param('tables') as $t) {
            $id = (string) ($t['id'] ?? '');
            if (isset($valid[$id])) {
                $layout[$id] = self::clean_pos((array) $t, $layout[$id] ?? []);
            }
        }
        update_option('mc_layout', $layout, false);
        return self::ok(['tables' => MC_Repo::tables()]);
    }

    private static function table_fields(array $p, bool $full)
    {
        $out = [];
        if ($full || array_key_exists('name', $p)) {
            $n = mb_substr(sanitize_text_field((string) ($p['name'] ?? '')), 0, 20);
            if ($n === '') return self::err('mc_bad_name', 'Dai un nome al tavolo.');
            $out['table_name'] = $n;
        }
        if ($full || array_key_exists('seats', $p)) {
            $s = filter_var($p['seats'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 30]]);
            if ($s === false) return self::err('mc_bad_seats', 'Posti non validi (1–30).');
            $out['guests'] = $s;
        }
        if ($full || array_key_exists('area', $p)) {
            $a = (int) ($p['area'] ?? 0);
            global $wpdb;
            if (!$wpdb->get_var($wpdb->prepare('SELECT id FROM ' . self::t('nd_booking_areas') . ' WHERE id = %d', $a))) return self::err('mc_bad_area', 'Sala inesistente.');
            $out['area_id'] = $a;
        }
        return $out;
    }

    public static function create_table(WP_REST_Request $r)
    {
        global $wpdb;
        $p = (array) $r->get_json_params();
        $f = self::table_fields($p, true);
        if (is_wp_error($f)) return $f;
        $wpdb->insert(self::t('nd_booking_tables'), $f + ['status' => 'available']);
        $id = (string) $wpdb->insert_id;
        $layout = (array) get_option('mc_layout', []);
        $layout[$id] = self::clean_pos($p);
        update_option('mc_layout', $layout, false);
        return self::ok(['tables' => MC_Repo::tables(), 'id' => $id], 201);
    }

    public static function update_table(WP_REST_Request $r)
    {
        global $wpdb;
        $id = (int) $r['id'];
        $p = (array) $r->get_json_params();
        if (!in_array((string) $id, MC_Repo::table_ids(), true)) return self::err('mc_not_found', 'Tavolo inesistente.', 404);
        $f = self::table_fields($p, false);
        if (is_wp_error($f)) return $f;
        if ($f) $wpdb->update(self::t('nd_booking_tables'), $f, ['id' => $id]);
        if (array_intersect(array_keys($p), ['x', 'y', 'shape', 'rot'])) {
            $layout = (array) get_option('mc_layout', []);
            $layout[(string) $id] = self::clean_pos($p, $layout[(string) $id] ?? []);
            update_option('mc_layout', $layout, false);
        }
        return self::ok(['tables' => MC_Repo::tables()]);
    }

    /** Removes the table and its assignment to upcoming bookings; past history is kept. */
    public static function delete_table(WP_REST_Request $r)
    {
        global $wpdb;
        $id = (int) $r['id'];
        if (!$wpdb->delete(self::t('nd_booking_tables'), ['id' => $id])) return self::err('mc_not_found', 'Tavolo inesistente.', 404);
        $wpdb->query($wpdb->prepare('DELETE FROM ' . self::t('reserved_tables') . ' WHERE table_id = %d AND date >= %s', $id, current_time('Y-m-d')));
        $layout = (array) get_option('mc_layout', []);
        unset($layout[(string) $id]);
        update_option('mc_layout', $layout, false);
        return self::ok(['tables' => MC_Repo::tables()]);
    }

    public static function create_area(WP_REST_Request $r)
    {
        global $wpdb;
        $n = mb_substr(sanitize_text_field((string) $r->get_param('name')), 0, 40);
        if ($n === '') return self::err('mc_bad_name', 'Dai un nome alla sala.');
        $wpdb->insert(self::t('nd_booking_areas'), ['area_name' => $n]);
        return self::ok(['areas' => MC_Repo::areas(), 'id' => (string) $wpdb->insert_id], 201);
    }

    public static function update_area(WP_REST_Request $r)
    {
        global $wpdb;
        $n = mb_substr(sanitize_text_field((string) $r->get_param('name')), 0, 40);
        if ($n === '') return self::err('mc_bad_name', 'Dai un nome alla sala.');
        $wpdb->update(self::t('nd_booking_areas'), ['area_name' => $n], ['id' => (int) $r['id']]);
        return self::ok(['areas' => MC_Repo::areas()]);
    }

    public static function delete_area(WP_REST_Request $r)
    {
        global $wpdb;
        $id = (int) $r['id'];
        $n = (int) $wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM ' . self::t('nd_booking_tables') . ' WHERE area_id = %d', $id));
        if ($n) return self::err('mc_area_not_empty', 'Prima sposta o elimina i tavoli di questa sala.', 409);
        if ((int) $wpdb->get_var('SELECT COUNT(*) FROM ' . self::t('nd_booking_areas')) <= 1) return self::err('mc_last_area', 'Serve almeno una sala.', 409);
        $wpdb->delete(self::t('nd_booking_areas'), ['id' => $id]);
        return self::ok(['areas' => MC_Repo::areas()]);
    }

    /* ---------- settings ---------- */

    private static function hhmm($s): ?string
    {
        if ($s === '24:00') return '24:00';
        return is_string($s) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $s) ? $s : null;
    }

    /** Partial update: only the keys present in the body are saved. */
    public static function save_settings(WP_REST_Request $r)
    {
        $p = (array) $r->get_json_params();
        $notes = [];

        if (isset($p['duration'])) {
            $d = (int) $p['duration'];
            if ($d < 15 || $d > 300) return self::err('mc_bad_duration', 'Durata non valida.');
            update_option('nd_rst_booking_duration', (string) $d);
        }
        if (isset($p['interval'])) {
            $i = (int) $p['interval'];
            if (!in_array($i, [15, 30, 60], true)) return self::err('mc_bad_interval', 'Intervallo non valido.');
            update_option('nd_rst_slot_interval', (string) $i);
        }
        if (isset($p['maxOnline'])) {
            $m = (int) $p['maxOnline'];
            if ($m < 1 || $m > 100) return self::err('mc_bad_max', 'Numero massimo non valido.');
            update_option('nd_rst_max_guests', (string) $m);
        }
        if (isset($p['defaultStatus'])) {
            $s = (string) $p['defaultStatus'];
            if (!in_array($s, ['attesa', 'confermata'], true)) return self::err('mc_bad_status', 'Stato non valido.');
            update_option('nd_rst_default_order_status', $s === 'confermata' ? 'confirmed' : 'pending');
        }
        if (isset($p['occasions'])) {
            // The legacy table stores occasions by position: existing ones can be renamed, never removed or reordered.
            $cur = MC_Repo::occasions();
            $new = array_values(array_filter(array_map(fn($o) => mb_substr(sanitize_text_field(str_replace(',', ' ', (string) $o)), 0, 30), (array) $p['occasions'])));
            if (count($new) < count($cur)) return self::err('mc_occasion_removed', 'Le occasioni già usate si possono rinominare ma non eliminare.');
            update_option('nd_rst_occasions', implode(', ', $new));
        }
        if (isset($p['week'])) {
            $week = [];
            for ($d = 0; $d < 7; $d++) {
                foreach (['pranzo', 'cena'] as $k) {
                    $h = (array) ($p['week'][$d][$k] ?? []);
                    $start = self::hhmm($h['start'] ?? null);
                    $end = self::hhmm($h['end'] ?? null);
                    if (!$start || !$end || ($end !== '24:00' && $end <= $start)) return self::err('mc_bad_hours', 'Orari non validi.');
                    $week[$d][$k] = ['on' => !empty($h['on']), 'start' => $start, 'end' => $end];
                }
            }
            update_option('mc_week', $week, false);
            if (!self::sync_legacy_timing($week)) {
                $notes[] = 'Orari diversi da un giorno all’altro: il modulo sul sito mantiene i suoi orari.';
            }
        }
        if (isset($p['closures'])) {
            $list = [];
            foreach ((array) $p['closures'] as $c) {
                $date = (string) ($c['date'] ?? '');
                if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return self::err('mc_bad_date', 'Data di chiusura non valida.');
                $type = ($c['type'] ?? '') === 'orario' ? 'orario' : 'chiuso';
                $start = self::hhmm($c['start'] ?? '') ?: '12:00';
                $end = self::hhmm($c['end'] ?? '') ?: '22:30';
                $list[] = [$date, $type, $start, $end];
            }
            $old = (int) get_option('nd_rst_exceptions_qnt', 0);
            $qnt = max(10, count($list));
            for ($i = 1; $i <= max($qnt, $old); $i++) {
                $c = $list[$i - 1] ?? null;
                update_option("nd_rst_exception_date_$i", $c ? $c[0] : '');
                update_option("nd_rst_exception_close_$i", $c && $c[1] === 'chiuso' ? '1' : '');
                update_option("nd_rst_exception_start_$i", $c ? $c[2] : '00:00');
                update_option("nd_rst_exception_end_$i", $c ? $c[3] : '00:00');
            }
            update_option('nd_rst_exceptions_qnt', (string) $qnt);
            $notes_map = [];
            foreach ((array) $p['closures'] as $c) {
                $notes_map[(string) ($c['date'] ?? '')] = mb_substr(sanitize_text_field((string) ($c['note'] ?? '')), 0, 60);
            }
            update_option('mc_closure_notes', $notes_map, false);
        }
        if (isset($p['discounts'])) {
            $rules = [];
            foreach ((array) $p['discounts'] as $d) {
                $min = (int) ($d['min'] ?? 0);
                $max = (int) ($d['max'] ?? 0);
                $pct = (int) ($d['pct'] ?? 0);
                $qty = (int) ($d['qty'] ?? 0);
                if ($min < 1 || $max < $min || $pct < 1 || $pct > 90 || $qty < 1) return self::err('mc_bad_discount', 'Regola di sconto non valida.');
                $rules[] = [
                    'discount_amount'     => $pct . '%',
                    'discount_min_people' => (string) $min,
                    'discount_max_people' => (string) $max,
                    'discount_text'       => mb_substr(sanitize_text_field((string) ($d['text'] ?? "Sconto $pct%")), 0, 30),
                    'available_discounts' => (string) $qty,
                ];
            }
            update_option('nd_booking_discounts_settings', $rules);
        }
        return self::ok(['settings' => MC_Repo::settings(), 'notes' => $notes]);
    }

    /**
     * The legacy form has global time slots switched on per weekday. When every open day uses
     * the same lunch and dinner hours they can be expressed there; otherwise the form is left as is.
     */
    private static function sync_legacy_timing(array $week): bool
    {
        $hours = [];
        foreach (['pranzo', 'cena'] as $k) {
            $set = [];
            foreach ($week as $day) {
                if ($day[$k]['on']) $set[$day[$k]['start'] . '-' . $day[$k]['end']] = $day[$k];
            }
            if (count($set) > 1) return false;
            $hours[$k] = $set ? reset($set) : null;
        }
        $slots = array_values(array_filter([$hours['pranzo'], $hours['cena']]));
        update_option('nd_rst_timing_qnt', (string) max(1, count($slots)));
        foreach ($slots as $i => $h) {
            $n = $i + 1;
            update_option("nd_rst_timing_start_$n", $h['start']);
            update_option("nd_rst_timing_end_$n", $h['end'] === '24:00' ? '23:59' : $h['end']);
        }
        // Weekday flags: legacy uses ISO day numbers (1 = Monday) and slot positions.
        $keys = array_values(array_filter(['pranzo', 'cena'], fn($k) => $hours[$k] !== null));
        for ($d = 0; $d < 7; $d++) {
            for ($n = 1; $n <= 10; $n++) {
                $k = $keys[$n - 1] ?? null;
                update_option('nd_rst_timing_' . ($d + 1) . "_$n", $k && $week[$d][$k]['on'] ? '1' : '');
            }
        }
        return true;
    }
}
