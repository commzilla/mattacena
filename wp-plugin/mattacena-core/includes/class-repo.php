<?php
defined('ABSPATH') || exit;

/**
 * Reads and writes bookings, areas and tables in the tables of the existing
 * "Restaurant Reservations" plugin (nd-restaurant-reservations), so both the
 * website form and the app work on the same data.
 */
class MC_Repo
{
    const STATUS_TO_LEGACY = [
        'attesa'     => 'pending',
        'confermata' => 'confirmed',
        'arrivata'   => 'arrived',
        'noshow'     => 'noshow',
        'cancellata' => 'cancelled',
    ];
    const SOURCES = ['online', 'telefono', 'walkin'];

    private static function t(string $name): string
    {
        global $wpdb;
        return $wpdb->prefix . $name;
    }

    public static function status_from_legacy(string $s): string
    {
        return match (strtolower($s)) {
            'confirmed'                         => 'confermata',
            'arrived', 'completed'              => 'arrivata',
            'noshow', 'no-show'                 => 'noshow',
            'cancelled', 'canceled', 'rejected' => 'cancellata',
            default                             => 'attesa',
        };
    }

    /* ---------- settings ---------- */

    public static function occasions(): array
    {
        $o = array_values(array_filter(array_map('trim', explode(',', (string) get_option('nd_rst_occasions', 'Casual')))));
        return $o ?: ['Casual'];
    }

    public static function settings(): array
    {
        $duration = (int) get_option('nd_rst_booking_duration', 60) ?: 60;
        $interval = (int) get_option('nd_rst_slot_interval', 30) ?: 30;

        // Weekly service hours are stored by this plugin: the legacy timing options
        // describe one 12:00–22:00 block and cannot express lunch and dinner separately.
        $week = get_option('mc_week');
        if (!is_array($week)) {
            $week = [];
            for ($d = 0; $d < 7; $d++) {
                $week[$d] = [
                    'pranzo' => ['on' => true, 'start' => '12:00', 'end' => '15:30'],
                    'cena'   => ['on' => true, 'start' => '19:00', 'end' => '22:30'],
                ];
            }
        }

        $closures = [];
        $n = (int) get_option('nd_rst_exceptions_qnt', 0);
        for ($i = 1; $i <= $n; $i++) {
            $date = self::legacy_date((string) get_option("nd_rst_exception_date_$i", ''));
            if (!$date) {
                continue;
            }
            $closed = (string) get_option("nd_rst_exception_close_$i", '') === '1';
            $closures[] = $closed
                ? ['id' => "x$i", 'date' => $date, 'type' => 'chiuso', 'note' => 'Chiuso']
                : ['id' => "x$i", 'date' => $date, 'type' => 'orario', 'start' => substr((string) get_option("nd_rst_exception_start_$i"), 0, 5), 'end' => substr((string) get_option("nd_rst_exception_end_$i"), 0, 5), 'note' => 'Orario speciale'];
        }

        $discounts = [];
        foreach ((array) get_option('nd_booking_discounts_settings', []) as $i => $d) {
            $discounts[] = [
                'id'   => 'd' . $i,
                'min'  => (int) ($d['discount_min_people'] ?? 0),
                'max'  => (int) ($d['discount_max_people'] ?? 0),
                'pct'  => (int) preg_replace('/\D/', '', (string) ($d['discount_amount'] ?? '0')),
                'qty'  => (int) ($d['available_discounts'] ?? 0),
                'text' => trim((string) ($d['discount_text'] ?? '')),
            ];
        }

        return [
            'duration'      => $duration,
            'interval'      => $interval,
            'maxOnline'     => (int) get_option('nd_rst_max_guests', 27) ?: 27,
            'defaultStatus' => self::status_from_legacy((string) get_option('nd_rst_default_order_status', 'pending')),
            'occasions'     => self::occasions(),
            'week'          => $week,
            'closures'      => $closures,
            'discounts'     => $discounts,
            'notify'        => ['confirm' => true, 'reminder' => false, 'staff' => true, 'review' => false],
        ];
    }

    /** Exceptions were saved both as 2025-12-25 and 25/12/2025. */
    private static function legacy_date(string $s): ?string
    {
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
            return $s;
        }
        if (preg_match('#^(\d{2})/(\d{2})/(\d{4})$#', $s, $m)) {
            return "$m[3]-$m[2]-$m[1]";
        }
        return null;
    }

    /* ---------- areas and tables ---------- */

    public static function areas(): array
    {
        global $wpdb;
        $rows = $wpdb->get_results('SELECT id, area_name FROM ' . self::t('nd_booking_areas') . ' ORDER BY id');
        return array_map(fn($r) => ['id' => (string) $r->id, 'name' => $r->area_name], $rows);
    }

    /** Tables with their floor-plan position (stored in the mc_layout option). */
    public static function tables(): array
    {
        global $wpdb;
        $rows = $wpdb->get_results('SELECT id, table_name, guests, area_id FROM ' . self::t('nd_booking_tables') . ' ORDER BY area_id, id');
        $layout = (array) get_option('mc_layout', []);
        $out = [];
        $cursor = [];
        foreach ($rows as $r) {
            $seats = (int) $r->guests;
            $shape = $seats <= 2 ? 'round' : ($seats <= 4 ? 'square' : 'rect');
            $pos = $layout[$r->id] ?? null;
            if (!$pos) {
                // Default grid until someone arranges the room in the app.
                $c = $cursor[$r->area_id] ?? ['x' => 150, 'y' => 150];
                $pos = ['x' => $c['x'], 'y' => $c['y'], 'shape' => $shape, 'rot' => 0];
                $c['x'] += 220;
                if ($c['x'] > 1050) {
                    $c = ['x' => 150, 'y' => $c['y'] + 200];
                }
                $cursor[$r->area_id] = $c;
            }
            $out[] = [
                'id'    => (string) $r->id,
                'area'  => (string) $r->area_id,
                'name'  => $r->table_name,
                'seats' => $seats,
                'shape' => in_array($pos['shape'] ?? '', ['round', 'square', 'rect'], true) ? $pos['shape'] : $shape,
                'rot'   => (int) ($pos['rot'] ?? 0),
                'x'     => (int) $pos['x'],
                'y'     => (int) $pos['y'],
            ];
        }
        return $out;
    }

    /* ---------- bookings ---------- */

    public static function list_bookings(string $from, string $to): array
    {
        global $wpdb;
        $b = self::t('nd_rst_booking');
        $m = self::t('mc_booking_meta');
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT b.*, m.source AS mc_source, m.discount AS mc_discount FROM $b b LEFT JOIN $m m ON m.booking_id = b.id
             WHERE b.nd_rst_date BETWEEN %s AND %s ORDER BY b.nd_rst_date, b.nd_rst_time_start",
            $from,
            $to
        ));
        return self::hydrate($rows);
    }

    public static function get_booking(int $id): ?array
    {
        global $wpdb;
        $b = self::t('nd_rst_booking');
        $m = self::t('mc_booking_meta');
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT b.*, m.source AS mc_source, m.discount AS mc_discount FROM $b b LEFT JOIN $m m ON m.booking_id = b.id WHERE b.id = %d",
            $id
        ));
        return $rows ? self::hydrate($rows)[0] : null;
    }

    private static function hydrate(array $rows): array
    {
        global $wpdb;
        if (!$rows) {
            return [];
        }
        $ids = array_map(fn($r) => (int) $r->id, $rows);
        $tables = [];
        $in = implode(',', array_fill(0, count($ids), '%d'));
        $res = $wpdb->get_results($wpdb->prepare('SELECT booking_id, table_id FROM ' . self::t('reserved_tables') . " WHERE booking_id IN ($in) ORDER BY id", $ids));
        foreach ($res as $r) {
            $tables[(int) $r->booking_id][] = (string) $r->table_id;
        }
        $occ = self::occasions();
        return array_map(function ($r) use ($tables, $occ) {
            $o = (string) $r->nd_rst_occasion;
            return [
                'id'       => (string) $r->id,
                'date'     => $r->nd_rst_date,
                'time'     => substr($r->nd_rst_time_start, 0, 5),
                'guests'   => (int) $r->nd_rst_guests,
                'name'     => trim($r->nd_rst_booking_form_name . ' ' . $r->nd_rst_booking_form_surname),
                'phone'    => $r->nd_rst_booking_form_phone,
                'email'    => $r->nd_rst_booking_form_email,
                'occasion' => ctype_digit($o) ? ($occ[(int) $o] ?? $occ[0]) : ($o ?: $occ[0]),
                'notes'    => $r->nd_rst_booking_form_requests,
                // Bookings made before the app existed all came from the website form.
                'source'   => in_array($r->mc_source, self::SOURCES, true) ? $r->mc_source : 'online',
                'status'   => self::status_from_legacy((string) $r->nd_rst_order_status),
                'tables'   => $tables[(int) $r->id] ?? [],
                'discount' => (string) ($r->mc_discount ?? ''),
            ];
        }, $rows);
    }

    /** @param array $in validated input (see MC_Rest::booking_input) */
    public static function create_booking(array $in, int $user_id): array
    {
        global $wpdb;
        [$first, $last] = self::split_name($in['name']);
        $wpdb->insert(self::t('nd_rst_booking'), [
            'nd_rst_restaurant'            => self::restaurant_id(),
            'nd_rst_guests'                => $in['guests'],
            'nd_rst_date'                  => $in['date'],
            'nd_rst_time_start'            => $in['time'] . ':00',
            'nd_rst_time_end'              => self::end_time($in['time']),
            'nd_rst_occasion'              => self::occasion_value($in['occasion']),
            'nd_rst_booking_form_name'     => $first,
            'nd_rst_booking_form_surname'  => $last,
            'nd_rst_booking_form_email'    => $in['email'],
            'nd_rst_booking_form_phone'    => $in['phone'],
            'nd_rst_booking_form_requests' => $in['notes'],
            'nd_rst_order_type'            => 'request',
            'nd_rst_order_status'          => self::STATUS_TO_LEGACY[$in['status']],
            'nd_rst_deposit'               => 0,
            'nd_rst_tx'                    => '',
            'nd_rst_currency'              => '',
        ]);
        $id = (int) $wpdb->insert_id;
        self::save_meta($id, $in['source'], $in['discount'] ?? '', $user_id);
        self::save_tables($id, $in['tables'], $in['date'], $in['time']);
        self::audit($user_id, $id, 'create', $in['guests'] . ' p. ' . $in['date'] . ' ' . $in['time']);
        return self::get_booking($id);
    }

    public static function update_booking(int $id, array $patch, int $user_id): ?array
    {
        global $wpdb;
        $cur = self::get_booking($id);
        if (!$cur) {
            return null;
        }
        $next = array_merge($cur, $patch);
        $cols = [];
        if (isset($patch['name'])) {
            [$cols['nd_rst_booking_form_name'], $cols['nd_rst_booking_form_surname']] = self::split_name($next['name']);
        }
        $map = ['guests' => 'nd_rst_guests', 'date' => 'nd_rst_date', 'email' => 'nd_rst_booking_form_email', 'phone' => 'nd_rst_booking_form_phone', 'notes' => 'nd_rst_booking_form_requests'];
        foreach ($map as $k => $col) {
            if (array_key_exists($k, $patch)) {
                $cols[$col] = $patch[$k];
            }
        }
        if (isset($patch['time'])) {
            $cols['nd_rst_time_start'] = $next['time'] . ':00';
            $cols['nd_rst_time_end'] = self::end_time($next['time']);
        }
        if (isset($patch['occasion'])) {
            $cols['nd_rst_occasion'] = self::occasion_value($next['occasion']);
        }
        if (isset($patch['status'])) {
            $cols['nd_rst_order_status'] = self::STATUS_TO_LEGACY[$next['status']];
        }
        if ($cols) {
            $wpdb->update(self::t('nd_rst_booking'), $cols, ['id' => $id]);
        }
        if (isset($patch['source']) || isset($patch['discount'])) {
            self::save_meta($id, $next['source'], $next['discount'], $user_id);
        }
        if (isset($patch['tables']) || isset($patch['date']) || isset($patch['time'])) {
            self::save_tables($id, $next['tables'], $next['date'], $next['time']);
        }
        $what = implode(', ', array_keys($patch));
        self::audit($user_id, $id, isset($patch['status']) && count($patch) === 1 ? 'status:' . $patch['status'] : 'update', substr($what, 0, 255));
        return self::get_booking($id);
    }

    public static function delete_booking(int $id, int $user_id): bool
    {
        global $wpdb;
        $ok = (bool) $wpdb->delete(self::t('nd_rst_booking'), ['id' => $id]);
        if ($ok) {
            $wpdb->delete(self::t('reserved_tables'), ['booking_id' => $id]);
            $wpdb->delete(self::t('mc_booking_meta'), ['booking_id' => $id]);
            self::audit($user_id, $id, 'delete');
        }
        return $ok;
    }

    public static function table_ids(): array
    {
        global $wpdb;
        return array_map('strval', $wpdb->get_col('SELECT id FROM ' . self::t('nd_booking_tables')));
    }

    /* ---------- helpers ---------- */

    private static function save_tables(int $id, array $tables, string $date, string $time): void
    {
        global $wpdb;
        $t = self::t('reserved_tables');
        $wpdb->delete($t, ['booking_id' => $id]);
        foreach (array_unique($tables) as $tid) {
            $wpdb->insert($t, ['table_id' => (int) $tid, 'booking_id' => $id, 'time' => $time . ':00', 'date' => $date]);
        }
    }

    private static function save_meta(int $id, string $source, string $discount, int $user_id): void
    {
        global $wpdb;
        $wpdb->replace(self::t('mc_booking_meta'), [
            'booking_id' => $id,
            'source'     => $source,
            'discount'   => $discount,
            'updated_by' => $user_id,
            'updated_at' => current_time('mysql', true),
        ]);
    }

    private static function audit(int $user_id, int $booking_id, string $action, string $detail = ''): void
    {
        global $wpdb;
        $wpdb->insert(self::t('mc_audit'), [
            'user_id'    => $user_id,
            'booking_id' => $booking_id,
            'action'     => $action,
            'detail'     => $detail,
            'created_at' => current_time('mysql', true),
        ]);
    }

    /** The legacy plugin saves the first word as name and the rest as surname. */
    private static function split_name(string $full): array
    {
        $parts = preg_split('/\s+/', trim($full), 2);
        return [$parts[0] ?? '', $parts[1] ?? ''];
    }

    /** Same convention as the legacy plugin: a 60-minute booking at 21:00 ends at 21:59. */
    private static function end_time(string $time): string
    {
        $dur = (int) get_option('nd_rst_booking_duration', 60) ?: 60;
        [$h, $m] = array_map('intval', explode(':', $time));
        $end = min($h * 60 + $m + $dur - 1, 23 * 60 + 59);
        return sprintf('%02d:%02d:00', intdiv($end, 60), $end % 60);
    }

    /** The legacy table stores the occasion as its position in the list. */
    private static function occasion_value(string $occasion): string
    {
        $i = array_search($occasion, self::occasions(), true);
        return (string) ($i === false ? 0 : $i);
    }

    private static function restaurant_id(): int
    {
        $id = (int) get_option('mc_restaurant_id');
        if (!$id) {
            global $wpdb;
            $id = (int) $wpdb->get_var('SELECT nd_rst_restaurant FROM ' . self::t('nd_rst_booking') . ' ORDER BY id DESC LIMIT 1');
            if ($id) {
                update_option('mc_restaurant_id', $id, false);
            }
        }
        return $id;
    }
}
